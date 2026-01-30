// Batch stock data endpoint - fetches multiple symbols in one request
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

    // Fetch all stocks in parallel
    const results = await Promise.all(
      limitedSymbols.map(async (symbol) => {
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
            exDividendDate: metrics.dividendExDate || null,
            dividendDate: metrics.dividendPayDate || null,
            name: fhProfile?.name,
            exchange: fhProfile?.exchange,
            earningsDate: nextEarnings?.date,
            earningsEstimate: nextEarnings?.epsEstimate
          };
        } catch (err) {
          return { symbol, error: err.message };
        }
      })
    );

    // Convert array to object keyed by symbol for easy lookup
    const stocksMap = {};
    results.forEach(r => {
      stocksMap[r.symbol] = r;
    });

    return new Response(JSON.stringify({ 
      stocks: stocksMap,
      fetchedAt: Date.now()
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
