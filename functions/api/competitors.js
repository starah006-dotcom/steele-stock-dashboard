// Competitors API - returns competitor stocks for a given symbol
// Includes hardcoded mappings for the portfolio stocks plus dynamic lookup

const COMPETITOR_MAP = {
  // Tech Giants
  'NVDA': ['AMD', 'INTC', 'QCOM', 'AVGO', 'MRVL'],
  'AMD': ['NVDA', 'INTC', 'QCOM', 'ARM', 'MRVL'],
  'INTC': ['AMD', 'NVDA', 'QCOM', 'ARM', 'TXN'],
  
  // FAANG / Big Tech
  'AAPL': ['MSFT', 'GOOGL', 'AMZN', 'SAMSUNG', 'META'],
  'AMZN': ['WMT', 'TGT', 'SHOP', 'BABA', 'EBAY'],
  'GOOGL': ['META', 'MSFT', 'AMZN', 'AAPL', 'SNAP'],
  'META': ['GOOGL', 'SNAP', 'PINS', 'TWTR', 'TTWO'],
  'MSFT': ['GOOGL', 'AMZN', 'AAPL', 'CRM', 'ORCL'],
  
  // EV / Auto
  'TSLA': ['RIVN', 'LCID', 'F', 'GM', 'NIO'],
  
  // Energy / MLP (Midstream)
  'ET': ['EPD', 'MMP', 'PAA', 'WMB', 'MPLX'],
  'EPD': ['ET', 'MMP', 'PAA', 'WMB', 'MPLX'],
  'MMP': ['ET', 'EPD', 'PAA', 'WMB', 'MPLX'],
  
  // Banks / Financial
  'JPM': ['BAC', 'WFC', 'C', 'GS', 'MS'],
  'BAC': ['JPM', 'WFC', 'C', 'USB', 'PNC'],
  
  // Software / AI
  'PLTR': ['SNOW', 'AI', 'DDOG', 'MDB', 'CRWD'],
  
  // REITs / Mortgage
  'AGNC': ['NLY', 'STWD', 'ARR', 'TWO', 'MFA'],
  
  // Crypto / Bitcoin
  'ARKB': ['IBIT', 'GBTC', 'BITO', 'FBTC', 'BITB'],
  'BLOK': ['ARKB', 'BITQ', 'IBIT', 'MARA', 'RIOT'],
  
  // Hardware / Computing
  'DELL': ['HPQ', 'HPE', 'LNVGY', 'SMCI', 'IBM'],
  
  // CEFs / Mining
  'BTO': ['NEM', 'GOLD', 'AEM', 'KGC', 'FNV'],
  
  // ETFs - map to similar ETFs or holdings
  'THNQ': ['QQQ', 'ARKK', 'XLK', 'VGT', 'IGV'],
  'XOVR': ['QQQ', 'ARKK', 'BLOK', 'SMH', 'SOXX'],
};

// Sector mapping for industry comparison
const SECTOR_MAP = {
  'NVDA': 'Semiconductors',
  'AMD': 'Semiconductors',
  'INTC': 'Semiconductors',
  'QCOM': 'Semiconductors',
  'AVGO': 'Semiconductors',
  'AAPL': 'Big Tech',
  'AMZN': 'Big Tech',
  'GOOGL': 'Big Tech',
  'META': 'Big Tech',
  'MSFT': 'Big Tech',
  'TSLA': 'Electric Vehicles',
  'RIVN': 'Electric Vehicles',
  'LCID': 'Electric Vehicles',
  'NIO': 'Electric Vehicles',
  'ET': 'Midstream Energy',
  'EPD': 'Midstream Energy',
  'MMP': 'Midstream Energy',
  'WMB': 'Midstream Energy',
  'PAA': 'Midstream Energy',
  'MPLX': 'Midstream Energy',
  'JPM': 'Banks',
  'BAC': 'Banks',
  'WFC': 'Banks',
  'C': 'Banks',
  'GS': 'Banks',
  'PLTR': 'Enterprise Software',
  'SNOW': 'Enterprise Software',
  'CRM': 'Enterprise Software',
  'DDOG': 'Enterprise Software',
  'AGNC': 'Mortgage REITs',
  'NLY': 'Mortgage REITs',
  'STWD': 'Mortgage REITs',
  'ARKB': 'Bitcoin ETFs',
  'IBIT': 'Bitcoin ETFs',
  'GBTC': 'Bitcoin ETFs',
  'BLOK': 'Blockchain',
  'DELL': 'Computer Hardware',
  'HPQ': 'Computer Hardware',
  'BTO': 'Gold Mining',
  'NEM': 'Gold Mining',
};

// Industry sectors for comparison view
const INDUSTRIES = {
  'Semiconductors': ['NVDA', 'AMD', 'INTC', 'QCOM', 'AVGO', 'MRVL', 'TXN', 'ARM'],
  'Big Tech': ['AAPL', 'AMZN', 'GOOGL', 'META', 'MSFT'],
  'Electric Vehicles': ['TSLA', 'RIVN', 'LCID', 'F', 'GM', 'NIO'],
  'Midstream Energy': ['ET', 'EPD', 'MMP', 'WMB', 'PAA', 'MPLX', 'KMI', 'OKE'],
  'Banks': ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'USB', 'PNC'],
  'Enterprise Software': ['PLTR', 'SNOW', 'CRM', 'DDOG', 'MDB', 'CRWD'],
  'Mortgage REITs': ['AGNC', 'NLY', 'STWD', 'ARR', 'TWO', 'MFA'],
  'Bitcoin ETFs': ['ARKB', 'IBIT', 'GBTC', 'FBTC', 'BITB', 'BITO'],
  'Computer Hardware': ['DELL', 'HPQ', 'HPE', 'SMCI', 'IBM'],
  'Gold Mining': ['BTO', 'NEM', 'GOLD', 'AEM', 'KGC', 'FNV'],
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol')?.toUpperCase();
  const industry = url.searchParams.get('industry');
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=300" // 5 min cache
  };
  
  try {
    // If requesting industry list
    if (url.searchParams.get('list') === 'industries') {
      return new Response(JSON.stringify({
        industries: Object.keys(INDUSTRIES),
        details: INDUSTRIES
      }), { headers });
    }
    
    // If requesting specific industry comparison
    if (industry) {
      const industrySymbols = INDUSTRIES[industry];
      if (!industrySymbols) {
        return new Response(JSON.stringify({ 
          error: 'Unknown industry',
          available: Object.keys(INDUSTRIES)
        }), { status: 400, headers });
      }
      
      // Fetch data for all industry stocks
      const FINNHUB_KEY = env.FINNHUB_API_KEY;
      const stockData = await Promise.all(
        industrySymbols.map(async (sym) => {
          try {
            const [quote, profile, metrics] = await Promise.all([
              fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
              fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
              fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${sym}&metric=all&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({}))
            ]);
            
            const m = metrics?.metric || {};
            return {
              symbol: sym,
              name: profile?.name || sym,
              price: quote?.c,
              change: quote?.d,
              changePercent: quote?.dp,
              marketCap: (profile?.marketCapitalization || 0) * 1000000,
              pe: m.peTTM,
              dividendYield: m.dividendYieldIndicatedAnnual,
              ytdReturn: m.ytdPriceReturnDaily,
              week52High: m['52WeekHigh'],
              week52Low: m['52WeekLow'],
            };
          } catch (e) {
            return { symbol: sym, error: e.message };
          }
        })
      );
      
      return new Response(JSON.stringify({
        industry,
        stocks: stockData
      }), { headers });
    }
    
    // If requesting competitors for a specific stock
    if (symbol) {
      const competitors = COMPETITOR_MAP[symbol] || [];
      const sector = SECTOR_MAP[symbol] || 'Unknown';
      
      if (competitors.length === 0) {
        return new Response(JSON.stringify({
          symbol,
          sector,
          competitors: [],
          message: 'No competitors mapped for this symbol'
        }), { headers });
      }
      
      // Fetch data for the symbol and its competitors
      const FINNHUB_KEY = env.FINNHUB_API_KEY;
      const allSymbols = [symbol, ...competitors];
      
      const stockData = await Promise.all(
        allSymbols.map(async (sym) => {
          try {
            const [quote, profile, metrics] = await Promise.all([
              fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
              fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
              fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${sym}&metric=all&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({}))
            ]);
            
            const m = metrics?.metric || {};
            return {
              symbol: sym,
              name: profile?.name || sym,
              price: quote?.c,
              change: quote?.d,
              changePercent: quote?.dp,
              marketCap: (profile?.marketCapitalization || 0) * 1000000,
              pe: m.peTTM,
              forwardPE: m.peNTM,
              dividendYield: m.dividendYieldIndicatedAnnual,
              ytdReturn: m.ytdPriceReturnDaily,
              week52High: m['52WeekHigh'],
              week52Low: m['52WeekLow'],
              isTarget: sym === symbol
            };
          } catch (e) {
            return { symbol: sym, error: e.message, isTarget: sym === symbol };
          }
        })
      );
      
      return new Response(JSON.stringify({
        symbol,
        sector,
        target: stockData.find(s => s.isTarget),
        competitors: stockData.filter(s => !s.isTarget)
      }), { headers });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Missing symbol or industry parameter',
      usage: {
        competitors: '/api/competitors?symbol=NVDA',
        industry: '/api/competitors?industry=Semiconductors',
        listIndustries: '/api/competitors?list=industries'
      }
    }), { status: 400, headers });
    
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
