const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// Password protection
const SITE_PASSWORD = process.env.SITE_PASSWORD || 'Steele813';

const RAPIDAPI_KEY = 'd32c6f4d8amsh19566314d24b4e1p1fe082jsn8cb737a081b1';
const SA_HOST = 'seeking-alpha-finance.p.rapidapi.com';
const YF_HOST = 'yahoo-finance15.p.rapidapi.com';

// OpenAI for AI summaries (optional - falls back to basic summary if not set)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Middleware to check auth
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth check for all routes except login
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/auth') {
    return next();
  }
  
  const authCookie = req.headers.cookie?.split(';').find(c => c.trim().startsWith('auth='));
  if (authCookie?.includes('authenticated')) {
    return next();
  }
  
  // Serve login page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Steele Portfolio - Login</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, sans-serif; background: #0f0f23; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .login-box { background: #1a1a3e; padding: 40px; border-radius: 12px; border: 1px solid #2a2a4a; width: 320px; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        p { color: #888; font-size: 14px; margin-bottom: 24px; }
        input { width: 100%; padding: 12px; border: 1px solid #3a3a5a; border-radius: 8px; background: #12122a; color: #fff; font-size: 16px; margin-bottom: 16px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #2563eb; border: none; border-radius: 8px; color: #fff; font-size: 16px; cursor: pointer; }
        button:hover { background: #1d4ed8; }
        .error { color: #ef4444; font-size: 13px; margin-bottom: 16px; display: none; }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h1>🔐 Steele Portfolio</h1>
        <p>Enter password to access</p>
        <div class="error" id="error">Incorrect password</div>
        <form action="/auth" method="POST">
          <input type="password" name="password" placeholder="Password" autofocus required>
          <button type="submit">Access Dashboard</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Auth endpoint
app.post('/auth', (req, res) => {
  if (req.body.password === SITE_PASSWORD) {
    res.setHeader('Set-Cookie', 'auth=authenticated; Path=/; HttpOnly; Max-Age=86400');
    res.redirect('/');
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Steele Portfolio - Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, sans-serif; background: #0f0f23; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          .login-box { background: #1a1a3e; padding: 40px; border-radius: 12px; border: 1px solid #2a2a4a; width: 320px; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          p { color: #888; font-size: 14px; margin-bottom: 24px; }
          input { width: 100%; padding: 12px; border: 1px solid #3a3a5a; border-radius: 8px; background: #12122a; color: #fff; font-size: 16px; margin-bottom: 16px; box-sizing: border-box; }
          button { width: 100%; padding: 12px; background: #2563eb; border: none; border-radius: 8px; color: #fff; font-size: 16px; cursor: pointer; }
          .error { color: #ef4444; font-size: 13px; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="login-box">
          <h1>🔐 Steele Portfolio</h1>
          <p>Enter password to access</p>
          <div class="error">Incorrect password. Try again.</div>
          <form action="/auth" method="POST">
            <input type="password" name="password" placeholder="Password" autofocus required>
            <button type="submit">Access Dashboard</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }
});

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
    
    const [yfQuote, saArticles, saTranscripts, saPressReleases] = await Promise.all([
      fetchYF(`/api/v1/markets/stock/quotes?ticker=${symbol}`),
      fetchSA('/v1/symbols/analysis', { ticker_slug: symbol.toLowerCase(), page_number: 1 }).catch(() => ({})),
      fetchSA('/v1/symbols/transcripts', { ticker_slug: symbol.toLowerCase(), page_number: 1, size: 5 }).catch(() => ({})),
      fetchSA('/v1/symbols/press-releases', { ticker_slug: symbol.toLowerCase(), page_number: 1, size: 5 }).catch(() => ({}))
    ]);
    
    const quote = yfQuote.body?.[0] || {};
    
    res.json({
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
      trailingPE: quote.trailingPE,
      forwardPE: quote.forwardPE,
      dividendRate: quote.dividendRate,
      dividendYield: quote.dividendYield,
      dividendDate: quote.dividendDate ? new Date(quote.dividendDate * 1000).toISOString() : null,
      exDividendDate: quote.exDividendDate ? new Date(quote.exDividendDate * 1000).toISOString() : null,
      earningsDate: quote.earningsTimestamp ? new Date(quote.earningsTimestamp * 1000).toISOString() : null,
      analystRating: quote.averageAnalystRating,
      name: quote.shortName,
      longName: quote.longName,
      exchange: quote.fullExchangeName,
      articles: saArticles.data?.slice(0, 5) || [],
      transcripts: saTranscripts.data?.slice(0, 3) || [],
      pressReleases: saPressReleases.data?.slice(0, 5) || []
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// AI Summary endpoint
app.post('/api/ai-summary', async (req, res) => {
  try {
    const { stocks } = req.body;
    
    if (!OPENAI_API_KEY) {
      return res.json({ summary: null }); // Frontend will use fallback
    }
    
    // Build context for AI
    const stockSummaries = stocks.map(s => {
      let info = `${s.symbol} (${s.name}): $${s.price?.toFixed(2)}, ${s.changePercent >= 0 ? '+' : ''}${s.changePercent?.toFixed(1)}% today`;
      if (s.gainPct !== undefined) info += `, ${s.gainPct >= 0 ? '+' : ''}${s.gainPct?.toFixed(0)}% total gain`;
      if (s.yield) info += `, ${s.yield.toFixed(1)}% yield`;
      if (s.exDivDays !== null && s.exDivDays >= 0 && s.exDivDays <= 30) info += `, ex-div in ${s.exDivDays} days`;
      if (s.articles?.length) info += `. Recent headlines: ${s.articles.slice(0, 2).join('; ')}`;
      if (s.pressReleases?.length) info += `. Press: ${s.pressReleases[0]}`;
      return info;
    }).join('\n');
    
    const prompt = `You are a concise investment analyst. Analyze this portfolio and provide 3-5 brief insights. Focus on:
- Any stocks with concerning news (bearish signals)
- Upcoming ex-dividend dates to watch
- Notable performers (best/worst)
- Any actionable observations

Format each insight as a short paragraph. Use simple HTML: wrap stock tickers in <span class="stock-ticker">SYMBOL</span>, bullish observations in <span class="bullish">text</span>, bearish in <span class="bearish">text</span>. Each insight should be wrapped in <div class="stock-insight">...</div>.

Portfolio:
${stockSummaries}`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7
      })
    });
    
    const data = await openaiRes.json();
    const summary = data.choices?.[0]?.message?.content || null;
    
    res.json({ summary });
  } catch (err) {
    console.error('AI Summary Error:', err);
    res.json({ summary: null });
  }
});

app.listen(PORT, () => {
  console.log(`Steele Stock Dashboard running on port ${PORT}`);
});
