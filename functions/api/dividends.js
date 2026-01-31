// Dividend calendar endpoint - fetches from Nasdaq and caches
// Falls back when Finnhub metrics don't have dates

const CACHE_DURATION = 3600000; // 1 hour
let dividendCache = { data: null, fetchedAt: 0 };

export async function onRequestGet(context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=1800" // 30 min cache
  };

  try {
    const now = Date.now();
    
    // Return cached data if fresh
    if (dividendCache.data && (now - dividendCache.fetchedAt) < CACHE_DURATION) {
      return new Response(JSON.stringify({ 
        dividends: dividendCache.data,
        cached: true,
        fetchedAt: dividendCache.fetchedAt
      }), { headers });
    }

    // Fetch next 45 days of dividend calendar from Nasdaq
    const today = new Date();
    const dividendsBySymbol = {};
    
    // Fetch dividend calendar for the next 45 days (cover ~6 weeks)
    const dates = [];
    for (let i = 0; i <= 45; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0].replace(/-/g, '-'));
    }
    
    // Batch fetch - get a few key dates
    const keyDates = [0, 7, 14, 21, 28, 35, 42].map(days => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    });
    
    const fetchPromises = keyDates.map(async (dateStr) => {
      try {
        const formattedDate = dateStr.replace(/-/g, '-');
        const res = await fetch(`https://api.nasdaq.com/api/calendar/dividends?date=${formattedDate}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        if (!res.ok) return [];
        
        const data = await res.json();
        return data?.data?.calendar?.rows || [];
      } catch (e) {
        console.error(`Failed to fetch dividend calendar for ${dateStr}:`, e.message);
        return [];
      }
    });
    
    const results = await Promise.all(fetchPromises);
    
    // Combine all results and dedupe by symbol (keep earliest ex-date)
    results.flat().forEach(row => {
      const symbol = row.symbol;
      if (!symbol) return;
      
      // Parse the date (format: M/DD/YYYY or MM/DD/YYYY)
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      };
      
      const exDate = parseDate(row.dividend_Ex_Date);
      const payDate = parseDate(row.payment_Date);
      
      // Only keep if we don't have this symbol yet, or if this is an earlier date
      if (!dividendsBySymbol[symbol] || (exDate && (!dividendsBySymbol[symbol].exDividendDate || exDate < dividendsBySymbol[symbol].exDividendDate))) {
        dividendsBySymbol[symbol] = {
          symbol,
          exDividendDate: exDate,
          dividendDate: payDate,
          recordDate: parseDate(row.record_Date),
          dividendRate: row.dividend_Rate,
          announcementDate: parseDate(row.announcement_Date),
          companyName: row.companyName
        };
      }
    });
    
    // Cache the results
    dividendCache = {
      data: dividendsBySymbol,
      fetchedAt: now
    };
    
    return new Response(JSON.stringify({ 
      dividends: dividendsBySymbol,
      cached: false,
      count: Object.keys(dividendsBySymbol).length,
      fetchedAt: now
    }), { headers });
    
  } catch (err) {
    console.error('Dividend calendar error:', err);
    return new Response(JSON.stringify({ 
      error: err.message,
      dividends: dividendCache.data || {}
    }), { status: 500, headers });
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
