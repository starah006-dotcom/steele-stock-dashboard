// Stock data endpoint using Finnhub + Seeking Alpha
export async function onRequestGet(context) {
  const { params, env } = context;
  const symbol = params.symbol.toUpperCase();
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    const FINNHUB_KEY = env.FINNHUB_API_KEY;
    const RAPIDAPI_KEY = env.RAPIDAPI_KEY;
    const SA_HOST = 'seeking-alpha-finance.p.rapidapi.com';

    // Fetch from Finnhub
    const [fhQuote, fhProfile, fhMetrics] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({}))
    ]);

    // Fetch from Seeking Alpha
    const saHeaders = { 'x-rapidapi-host': SA_HOST, 'x-rapidapi-key': RAPIDAPI_KEY };
    const [saArticles, saTranscripts, saPressReleases] = await Promise.all([
      fetch(`https://${SA_HOST}/v1/symbols/analysis?ticker_slug=${symbol.toLowerCase()}&page_number=1`, { headers: saHeaders }).then(r => r.json()).catch(() => ({})),
      fetch(`https://${SA_HOST}/v1/symbols/transcripts?ticker_slug=${symbol.toLowerCase()}&page_number=1&size=5`, { headers: saHeaders }).then(r => r.json()).catch(() => ({})),
      fetch(`https://${SA_HOST}/v1/symbols/press-releases?ticker_slug=${symbol.toLowerCase()}&page_number=1&size=5`, { headers: saHeaders }).then(r => r.json()).catch(() => ({}))
    ]);

    const metrics = fhMetrics?.metric || {};

    return new Response(JSON.stringify({
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
      name: fhProfile?.name,
      exchange: fhProfile?.exchange,
      articles: saArticles.data?.slice(0, 5) || [],
      transcripts: saTranscripts.data?.slice(0, 3) || [],
      pressReleases: saPressReleases.data?.slice(0, 5) || []
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
