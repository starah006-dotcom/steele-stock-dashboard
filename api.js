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

async function getStockData(symbol) {
  const [info, dividendRate, articles] = await Promise.all([
    fetchSA('/v1/symbols/data', { ticker_slug: symbol }),
    fetchSA('/v1/symbols/metrics', { ticker_slug: symbol, category: 'dividend_rate' }),
    fetchSA('/v1/symbols/analysis', { ticker_slug: symbol, page_number: 1 })
  ]);
  
  return {
    info: info.data,
    dividendRate: dividendRate.data?.[0]?.attributes?.value,
    articles: articles.data
  };
}

module.exports = { fetchSA, getStockData };
