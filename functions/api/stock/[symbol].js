// Stock data endpoint using Finnhub for all data (Seeking Alpha deprecated)
export async function onRequestGet(context) {
  const { params, env } = context;
  const symbol = params.symbol.toUpperCase();
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60, s-maxage=30"
  };

  try {
    const FINNHUB_KEY = env.FINNHUB_API_KEY;
    
    // Get date range for news (last 30 days)
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch from Finnhub - quote, profile, metrics, filings, earnings, and news
    const [fhQuote, fhProfile, fhMetrics, fhFilings10K, fhFilings10Q, fhFilings8K, fhEarnings, fhNews] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&form=10-K&token=${FINNHUB_KEY}`).then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
      fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&form=10-Q&token=${FINNHUB_KEY}`).then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
      fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&form=8-K&token=${FINNHUB_KEY}`).then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
      fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.json()).catch(() => ({})),
      fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${thirtyDaysAgo}&to=${today}&token=${FINNHUB_KEY}`).then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => [])
    ]);
    
    // Combine filings from all form types
    const fhFilings = [...(fhFilings10K || []), ...(fhFilings10Q || []), ...(fhFilings8K || [])];

    const metrics = fhMetrics?.metric || {};
    
    // Sort filings by date
    const allFilings = (fhFilings || []).sort((a, b) => new Date(b.filedDate) - new Date(a.filedDate));
    
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

    // Categorize news - separate press releases from analysis
    const pressKeywords = ['announces', 'reports', 'declares', 'completes', 'launches', 'expands', 'appoints', 'names', 'enters', 'receives', 'signs', 'partners'];
    const transcriptKeywords = ['earnings call', 'conference call', 'q1', 'q2', 'q3', 'q4', 'transcript'];
    
    const allNews = (fhNews || []).slice(0, 50);
    
    const pressReleases = allNews.filter(n => {
      const headline = (n.headline || '').toLowerCase();
      return pressKeywords.some(k => headline.includes(k)) || n.source === 'Company News';
    }).slice(0, 5).map(n => ({
      attributes: {
        title: n.headline,
        publishOn: new Date(n.datetime * 1000).toISOString()
      },
      links: { self: n.url }
    }));

    const articles = allNews.filter(n => {
      const headline = (n.headline || '').toLowerCase();
      return !pressKeywords.some(k => headline.includes(k)) && !transcriptKeywords.some(k => headline.includes(k));
    }).slice(0, 5).map(n => ({
      attributes: {
        title: n.headline,
        publishOn: new Date(n.datetime * 1000).toISOString()
      },
      links: { self: n.url }
    }));

    const transcripts = allNews.filter(n => {
      const headline = (n.headline || '').toLowerCase();
      return transcriptKeywords.some(k => headline.includes(k));
    }).slice(0, 3).map(n => ({
      attributes: {
        title: n.headline,
        publishOn: new Date(n.datetime * 1000).toISOString()
      },
      links: { self: n.url }
    }));

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
      exDividendDate: metrics.dividendExDate || null,
      dividendDate: metrics.dividendPayDate || null,
      name: fhProfile?.name,
      exchange: fhProfile?.exchange,
      weburl: fhProfile?.weburl,
      // SEC Filings
      secFilings: secFilings,
      secEdgarUrl: cik ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K&dateb=&owner=include&count=40` : null,
      // Earnings
      nextEarningsDate: nextEarnings?.date,
      earningsEstimate: nextEarnings?.epsEstimate,
      // News (from Finnhub)
      articles: articles,
      transcripts: transcripts,
      pressReleases: pressReleases
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
// deployed 2026-01-30_finnhub-news
