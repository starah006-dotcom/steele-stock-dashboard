const express = require('express');
const fetch = require('node-fetch');

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
    
    const [info, dividendRate, dividendScorecard, articles, transcripts, pressReleases] = await Promise.all([
      fetchSA('/v1/symbols/data', { ticker_slug: symbol }),
      fetchSA('/v1/symbols/metrics', { ticker_slug: symbol, category: 'dividend_rate' }),
      fetchSA('/v1/symbols/metrics', { ticker_slug: symbol, category: 'dividend_scorecard' }),
      fetchSA('/v1/symbols/analysis', { ticker_slug: symbol, page_number: 1 }),
      fetchSA('/v1/symbols/transcripts', { ticker_slug: symbol, page_number: 1, size: 5 }),
      fetchSA('/v1/symbols/press-releases', { ticker_slug: symbol, page_number: 1, size: 5 })
    ]);
    
    res.json({
      info: info.data,
      dividendRate: dividendRate.data?.[0]?.attributes?.value,
      dividendScorecard: dividendScorecard.data,
      articles: articles.data?.slice(0, 5) || [],
      transcripts: transcripts.data?.slice(0, 3) || [],
      pressReleases: pressReleases.data?.slice(0, 5) || []
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Steele Stock Dashboard running on port ${PORT}`);
});
