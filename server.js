const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// Password protection
const SITE_PASSWORD = process.env.SITE_PASSWORD || 'Steele813';

// API Keys
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'd32c6f4d8amsh19566314d24b4e1p1fe082jsn8cb737a081b1';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';

const SA_HOST = 'seeking-alpha-finance.p.rapidapi.com';
const YF_HOST = 'yahoo-finance15.p.rapidapi.com';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth check
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/auth') return next();
  
  const authCookie = req.headers.cookie?.split(';').find(c => c.trim().startsWith('auth='));
  if (authCookie?.includes('authenticated')) return next();
  
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
      </style>
    </head>
    <body>
      <div class="login-box">
        <h1>🔐 Steele Portfolio</h1>
        <p>Enter password to access</p>
        <form action="/auth" method="POST">
          <input type="password" name="password" placeholder="Password" autofocus required>
          <button type="submit">Access Dashboard</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

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

// API Helpers
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

async function fetchFinnhub(endpoint) {
  if (!FINNHUB_API_KEY) return null;
  const res = await fetch(`https://finnhub.io/api/v1${endpoint}&token=${FINNHUB_API_KEY}`);
  return res.json();
}

app.use(express.static('.'));

// Stock data endpoint
app.get('/api/stock/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    
    const [yfQuote, saArticles, saTranscripts, saPressReleases, finnhubNews] = await Promise.all([
      fetchYF(`/api/v1/markets/stock/quotes?ticker=${symbol}`),
      fetchSA('/v1/symbols/analysis', { ticker_slug: symbol.toLowerCase(), page_number: 1 }).catch(() => ({})),
      fetchSA('/v1/symbols/transcripts', { ticker_slug: symbol.toLowerCase(), page_number: 1, size: 5 }).catch(() => ({})),
      fetchSA('/v1/symbols/press-releases', { ticker_slug: symbol.toLowerCase(), page_number: 1, size: 5 }).catch(() => ({})),
      fetchFinnhub(`/company-news?symbol=${symbol}&from=${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`).catch(() => [])
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
      pressReleases: saPressReleases.data?.slice(0, 5) || [],
      finnhubNews: (finnhubNews || []).slice(0, 5)
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// AI Summary endpoint using Claude (primary) or OpenAI (fallback)
app.post('/api/ai-summary', async (req, res) => {
  try {
    const { stocks } = req.body;
    
    if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
      console.log('No AI API key configured');
      return res.json({ summary: null });
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
    
    const prompt = `You are a concise investment analyst providing a daily portfolio briefing. Analyze this portfolio and provide 4-6 actionable insights.

Focus on:
1. Any stocks with concerning news (bearish signals) - FLAG THESE PROMINENTLY
2. Upcoming ex-dividend dates (money on the table)
3. Earnings announcements coming up
4. Notable price movements today
5. Any positions significantly outperforming or underperforming
6. Risk observations (concentration, sector exposure)

Format each insight as a brief paragraph. Use HTML formatting:
- Stock tickers: <span class="stock-ticker">SYMBOL</span>
- Bullish observations: <span class="bullish">text</span>
- Bearish warnings: <span class="bearish">text</span>
- Wrap each insight in: <div class="stock-insight">...</div>

Be specific and actionable. No generic advice.

Portfolio (${stocks.length} positions):
${stockSummaries}`;

    let summary = null;
    
    // Try Claude first (better quality)
    if (ANTHROPIC_API_KEY) {
      try {
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        
        const claudeData = await claudeRes.json();
        
        if (claudeData.content?.[0]?.text) {
          summary = claudeData.content[0].text;
          console.log('AI Summary generated via Claude');
        } else if (claudeData.error) {
          console.error('Claude error:', claudeData.error);
        }
      } catch (claudeErr) {
        console.error('Claude request failed:', claudeErr.message);
      }
    }
    
    // Fallback to OpenAI if Claude failed
    if (!summary && OPENAI_API_KEY) {
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.7
        })
      });
      
      const openaiData = await openaiRes.json();
      
      if (openaiData.choices?.[0]?.message?.content) {
        summary = openaiData.choices[0].message.content;
        console.log('AI Summary generated via OpenAI');
      } else if (openaiData.error) {
        console.error('OpenAI error:', openaiData.error);
      }
    }
    
    res.json({ summary });
  } catch (err) {
    console.error('AI Summary Error:', err);
    res.json({ summary: null, error: err.message });
  }
});

// Deep research endpoint using Perplexity
app.post('/api/research', async (req, res) => {
  try {
    const { symbol, query } = req.body;
    
    if (!PERPLEXITY_API_KEY) {
      return res.json({ research: null });
    }
    
    const prompt = query || `Provide a brief investment research summary for ${symbol}. Include:
1. Recent news and developments (last 7 days)
2. Analyst sentiment and price targets
3. Key risks to watch
4. Upcoming catalysts (earnings, events)
Keep it concise and actionable for an investor.`;

    const pplxRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800
      })
    });
    
    const data = await pplxRes.json();
    const research = data.choices?.[0]?.message?.content || null;
    res.json({ research });
  } catch (err) {
    console.error('Research Error:', err);
    res.json({ research: null, error: err.message });
  }
});

// Earnings calendar endpoint
app.get('/api/earnings', async (req, res) => {
  try {
    const symbols = req.query.symbols?.split(',') || [];
    
    if (!FINNHUB_API_KEY || !symbols.length) {
      return res.json({ earnings: [] });
    }
    
    const earnings = await Promise.all(
      symbols.map(async symbol => {
        const data = await fetchFinnhub(`/calendar/earnings?symbol=${symbol}`);
        return { symbol, earnings: data?.earningsCalendar?.[0] || null };
      })
    );
    
    res.json({ earnings: earnings.filter(e => e.earnings) });
  } catch (err) {
    console.error('Earnings Error:', err);
    res.json({ earnings: [], error: err.message });
  }
});

// Market news endpoint
app.get('/api/market-news', async (req, res) => {
  try {
    if (!FINNHUB_API_KEY) {
      return res.json({ news: [] });
    }
    
    const news = await fetchFinnhub('/news?category=general');
    res.json({ news: (news || []).slice(0, 20) });
  } catch (err) {
    console.error('Market News Error:', err);
    res.json({ news: [], error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Steele Stock Dashboard running on port ${PORT}`);
  console.log(`APIs configured: Claude=${!!ANTHROPIC_API_KEY}, OpenAI=${!!OPENAI_API_KEY}, Finnhub=${!!FINNHUB_API_KEY}, Perplexity=${!!PERPLEXITY_API_KEY}`);
});
