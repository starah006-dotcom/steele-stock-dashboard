const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

const RAPIDAPI_KEY = 'd32c6f4d8amsh19566314d24b4e1p1fe082jsn8cb737a081b1';
const SA_HOST = 'seeking-alpha-finance.p.rapidapi.com';

async function fetchSA(endpoint, params = {}) {
  const url = new URL(`https://${SA_HOST}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-host': SA_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY
    }
  });
  return res.json();
}

app.use(express.static('.'));

app.get('/api/stock/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toLowerCase();
    
    const [info, dividendRate, dividendYield, articles] = await Promise.all([
      fetchSA('/v1/symbols/data', { ticker_slug: symbol }),
      fetchSA('/v1/symbols/metrics', { ticker_slug: symbol, category: 'dividend_rate' }),
      fetchSA('/v1/symbols/metrics', { ticker_slug: symbol, category: 'dividend_yield_category' }),
      fetchSA('/v1/symbols/analysis', { ticker_slug: symbol, page_number: 1 })
    ]);
    
    res.json({
      info: info.data,
      dividendRate: dividendRate.data?.[0]?.attributes?.value,
      dividendYield: dividendYield.data?.[0]?.attributes?.value,
      articles: articles.data?.slice(0, 5) || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
