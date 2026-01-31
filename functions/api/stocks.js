// Batch stock data endpoint - fetches multiple symbols in one request
// Now includes Nasdaq dividend calendar data for accurate ex-dividend dates

// Simple in-memory cache for dividend data (per-request, since CF Workers are stateless)
let dividendCacheData = null;
let dividendCacheTime = 0;
const DIVIDEND_CACHE_DURATION = 1800000; // 30 minutes

async function fetchDividendCalendar() {
  const now = Date.now();
  
  // Use cached data if fresh
  if (dividendCacheData && (now - dividendCacheTime) < DIVIDEND_CACHE_DURATION) {
    return dividendCacheData;
  }
  
  try {
    // Fetch dividend calendar from Nasdaq for next 45 days
    const today = new Date();
    const dividendsBySymbol = {};
    
    // Sample key dates over the next 6 weeks
    const keyDates = [0, 7, 14, 21, 28, 35, 42].map(days => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    });
    
    const fetchPromises = keyDates.map(async (dateStr) => {
      try {
        const res = await fetch(`https://api.nasdaq.com/api/calendar/dividends?date=${dateStr}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        if (!res.ok) return [];
        const data = await res.json();
        return data?.data?.calendar?.rows || [];
      } catch (e) {
        return [];
      }
    });
    
    const results = await Promise.all(fetchPromises);
    
    // Combine and dedupe by symbol
    results.flat().forEach(row => {
      const symbol = row.symbol;
      if (!symbol) return;
      
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      };
      
      const exDate = parseDate(row.dividend_Ex_Date);
      const payDate = parseDate(row.payment_Date);
      
      if (!dividendsBySymbol[symbol] || (exDate && (!dividendsBySymbol[symbol].exDividendDate || exDate < dividendsBySymbol[symbol].exDividendDate))) {
        dividendsBySymbol[symbol] = {
          exDividendDate: exDate,
          dividendDate: payDate,
          dividendRate: row.dividend_Rate
        };
      }
    });
    
    dividendCacheData = dividendsBySymbol;
    dividendCacheTime = now;
    return dividendsBySymbol;
  } catch (e) {
    console.error('Dividend calendar fetch failed:', e);
    return {};
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get('symbols') || '';
  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  
  if (symbols.length === 0) {
    return new Response(JSON.stringify({ error: 'No symbols provided' }), { 
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Limit to 20 symbols per request
  const limitedSymbols = symbols.slice(0, 20);
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60, s-maxage=30" // Cache 1 min client, 30s edge
  };

  try {
    const FINNHUB_KEY = env.FINNHUB_API_KEY;
    const RAPIDAPI_KEY = env.RAPIDAPI_KEY;
    const SA_HOST = 'seeking-alpha-finance.p.rapidapi.com';
    const saHeaders = { 'x-rapidapi-host': SA_HOST, 'x-rapidapi-key': RAPIDAPI_KEY };

    // Fetch dividend calendar data in parallel with stock data
    const [dividendCalendar, ...stockResults] = await Promise.all([
      fetchDividendCalendar(),
      ...limitedSymbols.map(async (symbol) => {
        try {
          // Parallel fetch for each symbol
          const [fhQuote, fhProfile, fhMetrics, fhEarnings] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`)
              .then(r => r.json()).catch(() => ({})),
            fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`)
              .then(r => r.json()).catch(() => ({})),
            fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`)
              .then(r => r.json()).catch(() => ({})),
            fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&token=${FINNHUB_KEY}`)
              .then(r => r.json()).catch(() => ({}))
          ]);

          // For batch endpoint, skip Seeking Alpha to reduce latency
          // Individual stock detail will still fetch full data
          const metrics = fhMetrics?.metric || {};
          const nextEarnings = fhEarnings?.earningsCalendar?.[0];

          return {
            symbol,
            price: fhQuote?.c,
            change: fhQuote?.d,
            changePercent: fhQuote?.dp,
            previousClose: fhQuote?.pc,
            dayHigh: fhQuote?.h,
            dayLow: fhQuote?.l,
            marketCap: (fhProfile?.marketCapitalization || 0) * 1000000,
            fiftyTwoWeekHigh: metrics['52WeekHigh'],
            fiftyTwoWeekLow: metrics['52WeekLow'],
            trailingPE: metrics.peTTM,
            dividendRate: metrics.dividendPerShareAnnual,
            dividendYield: metrics.dividendYieldIndicatedAnnual,
            // Finnhub metrics (may be null)
            finnhubExDate: metrics.dividendExDate || null,
            finnhubPayDate: metrics.dividendPayDate || null,
            name: fhProfile?.name,
            exchange: fhProfile?.exchange,
            earningsDate: nextEarnings?.date,
            earningsEstimate: nextEarnings?.epsEstimate
          };
        } catch (err) {
          return { symbol, error: err.message };
        }
      })
    ];

    // Merge dividend calendar data into stock results
    const stocksMap = {};
    stockResults.forEach(r => {
      if (!r.symbol) return;
      
      // Prefer Nasdaq dividend calendar data, fallback to Finnhub
      const nasdaqDiv = dividendCalendar[r.symbol];
      r.exDividendDate = nasdaqDiv?.exDividendDate || r.finnhubExDate || null;
      r.dividendDate = nasdaqDiv?.dividendDate || r.finnhubPayDate || null;
      
      // Clean up internal fields
      delete r.finnhubExDate;
      delete r.finnhubPayDate;
      
      stocksMap[r.symbol] = r;
    });

    return new Response(JSON.stringify({ 
      stocks: stocksMap,
      fetchedAt: Date.now(),
      dividendDataSource: Object.keys(dividendCalendar).length > 0 ? 'nasdaq+finnhub' : 'finnhub'
    }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
