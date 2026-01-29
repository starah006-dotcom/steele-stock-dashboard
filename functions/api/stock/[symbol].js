// Stock data endpoint using Finnhub + Seeking Alpha + SEC filings
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

    // Fetch from Finnhub - quote, profile, metrics, filings (by form type), and earnings
    const [fhQuote, fhProfile, fhMetrics, fhFilings10K, fhFilings10Q, fhFilings8K, fhEarnings] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&form=10-K&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => []),
      fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&form=10-Q&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => []),
      fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&form=8-K&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => []),
      fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({}))
    ]);
    
    // Combine filings from all form types
    const fhFilings = [...(fhFilings10K || []), ...(fhFilings10Q || []), ...(fhFilings8K || [])];

    // Fetch from Seeking Alpha
    const saHeaders = { 'x-rapidapi-host': SA_HOST, 'x-rapidapi-key': RAPIDAPI_KEY };
    const [saArticles, saTranscripts, saPressReleases] = await Promise.all([
      fetch(`https://${SA_HOST}/v1/symbols/analysis?ticker_slug=${symbol.toLowerCase()}&page_number=1`, { headers: saHeaders }).then(r => r.json()).catch(() => ({})),
      fetch(`https://${SA_HOST}/v1/symbols/transcripts?ticker_slug=${symbol.toLowerCase()}&page_number=1&size=5`, { headers: saHeaders }).then(r => r.json()).catch(() => ({})),
      fetch(`https://${SA_HOST}/v1/symbols/press-releases?ticker_slug=${symbol.toLowerCase()}&page_number=1&size=5`, { headers: saHeaders }).then(r => r.json()).catch(() => ({}))
    ]);

    const metrics = fhMetrics?.metric || {};
    
    // Filings are already filtered by form type from API calls
    const allFilings = (fhFilings || []).sort((a, b) => new Date(b.filedDate) - new Date(a.filedDate));
    
    // Get most recent of each type
    const latest10K = allFilings.find(f => f.form === '10-K');
    const latest10Q = allFilings.find(f => f.form === '10-Q');
    const latest8K = allFilings.find(f => f.form === '8-K');
    
    // Get all filings for history (up to 15)
    const secFilings = allFilings.slice(0, 15).map(f => ({
      form: f.form,
      filedDate: f.filedDate,
      reportUrl: f.reportUrl,
      filingUrl: f.filingUrl
    }));
    
    // CIK for SEC EDGAR link
    const cik = fhFilings?.[0]?.cik || null;
    
    // Get next earnings date from calendar
    const nextEarnings = fhEarnings?.earningsCalendar?.[0];

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
      weburl: fhProfile?.weburl,
      // SEC Filings
      secFilings: secFilings,
      secEdgarUrl: cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K&dateb=&owner=include&count=40` : null,
      // Earnings
      nextEarningsDate: nextEarnings?.date,
      earningsEstimate: nextEarnings?.epsEstimate,
      // Seeking Alpha content
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
