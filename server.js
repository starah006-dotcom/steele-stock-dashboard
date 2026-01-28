const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

const RAPIDAPI_KEY = 'd32c6f4d8amsh19566314d24b4e1p1fe082jsn8cb737a081b1';
const SA_HOST = 'seeking-alpha-finance.p.rapidapi.com';
const YF_HOST = 'yahoo-finance15.p.rapidapi.com';

async function fetchSA(endpoint, params = {}) {
  const url = new URL(`https://${SA_HOST}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetch(url, {
    headers: { 'x-rapidapi-host': SA_HOST, 'x-rapidapi-key': RAPIDAPI_KEY }
  });
  return res.json();
}

async function fetchYF(endpoint) {
  const res = await fetch(`https://${YF_HOST}${endpoint}`, {
    headers: { 'x-rapidapi-host': YF_HOST, 'x-rapidapi-key': RAPIDAPI_KEY }
  });
  return res.json();
}

app.use(express.static('.'));

app.get('/api/stock/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    
    // Fetch from both APIs in parallel
    const [yfQuote, saArticles, saTranscripts, saPressReleases] = await Promise.all([
      fetchYF(`/api/v1/markets/stock/quotes?ticker=${symbol}`),
      fetchSA('/v1/symbols/analysis', { ticker_slug: symbol.toLowerCase(), page_number: 1 }),
      fetchSA('/v1/symbols/transcripts', { ticker_slug: symbol.toLowerCase(), page_number: 1, size: 5 }),
      fetchSA('/v1/symbols/press-releases', { ticker_slug: symbol.toLowerCase(), page_number: 1, size: 5 })
    ]);
    
    const quote = yfQuote.body?.[0] || {};
    
    res.json({
      // Real-time data from Yahoo Finance
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePercent: quote.regularMarketChangePercent,
      previousClose: quote.regularMarketPreviousClose,
      dayHigh: quote.regularMarketDayHigh,
      dayLow: quote.regularMarketDayLow,
      volume: quote.regularMarketVolume,
      marketCap: quote.marketCap,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      
      // Dividend data
      dividendRate: quote.dividendRate,
      dividendYield: quote.dividendYield,
      dividendDate: quote.dividendDate ? new Date(quote.dividendDate * 1000).toISOString() : null,
      exDividendDate: quote.exDividendDate ? new Date(quote.exDividendDate * 1000).toISOString() : null,
      
      // Earnings
      earningsDate: quote.earningsTimestamp ? new Date(quote.earningsTimestamp * 1000).toISOString() : null,
      
      // Analyst rating
      analystRating: quote.averageAnalystRating,
      
      // Company info
      name: quote.shortName,
      longName: quote.longName,
      exchange: quote.fullExchangeName,
      
      // Seeking Alpha content
      articles: saArticles.data?.slice(0, 5) || [],
      transcripts: saTranscripts.data?.slice(0, 3) || [],
      pressReleases: saPressReleases.data?.slice(0, 5) || []
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Steele Stock Dashboard running on port ${PORT}`);
});
