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

// Stock data endpoint - using Finnhub for quotes (Yahoo Finance quota exceeded)
app.get('/api/stock/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    
    const [fhQuote, fhProfile, fhMetrics, saArticles, saTranscripts, saPressReleases, finnhubNews] = await Promise.all([
      fetchFinnhub(`/quote?symbol=${symbol}`).catch(() => ({})),
      fetchFinnhub(`/stock/profile2?symbol=${symbol}`).catch(() => ({})),
      fetchFinnhub(`/stock/metric?symbol=${symbol}&metric=all`).catch(() => ({})),
      fetchSA('/v1/symbols/analysis', { ticker_slug: symbol.toLowerCase(), page_number: 1 }).catch(() => ({})),
      fetchSA('/v1/symbols/transcripts', { ticker_slug: symbol.toLowerCase(), page_number: 1, size: 5 }).catch(() => ({})),
      fetchSA('/v1/symbols/press-releases', { ticker_slug: symbol.toLowerCase(), page_number: 1, size: 5 }).catch(() => ({})),
      fetchFinnhub(`/company-news?symbol=${symbol}&from=${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`).catch(() => [])
    ]);
    
    const metrics = fhMetrics?.metric || {};
    
    res.json({
      price: fhQuote?.c,
      change: fhQuote?.d,
      changePercent: fhQuote?.dp,
      previousClose: fhQuote?.pc,
      dayHigh: fhQuote?.h,
      dayLow: fhQuote?.l,
      volume: null, // Finnhub quote doesn't include volume
      marketCap: (fhProfile?.marketCapitalization || 0) * 1000000,
      fiftyTwoWeekHigh: metrics['52WeekHigh'],
      fiftyTwoWeekLow: metrics['52WeekLow'],
      trailingPE: metrics.peTTM,
      forwardPE: metrics.peNTM,
      dividendRate: metrics.dividendPerShareAnnual,
      dividendYield: metrics.dividendYieldIndicatedAnnual,
      dividendDate: null, // Would need separate API call
      exDividendDate: null, // Would need separate API call
      earningsDate: null, // Would need separate API call
      analystRating: metrics.targetMedianPrice ? `Target: $${metrics.targetMedianPrice.toFixed(0)}` : null,
      name: fhProfile?.name,
      longName: fhProfile?.name,
      exchange: fhProfile?.exchange,
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
          // Strip markdown code fences if present
          summary = summary.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
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
        // Strip markdown code fences if present
        summary = summary.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
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

// SEC Filing Summarization endpoint - fetches and analyzes actual filing content
app.post('/api/summarize-filing', async (req, res) => {
  try {
    const { filingUrl, formType, symbol } = req.body;
    
    if (!filingUrl) {
      return res.status(400).json({ error: 'Filing URL required' });
    }
    
    if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
      return res.json({ summary: null, error: 'No AI API key configured' });
    }
    
    console.log(`Fetching SEC filing: ${filingUrl}`);
    
    // Fetch the actual filing document
    let filingText = '';
    try {
      const filingRes = await fetch(filingUrl, {
        headers: {
          'User-Agent': 'SteeleDashboard/1.0 (Investment Research)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      
      if (!filingRes.ok) {
        throw new Error(`Failed to fetch filing: ${filingRes.status}`);
      }
      
      const contentType = filingRes.headers.get('content-type') || '';
      const rawContent = await filingRes.text();
      
      // Extract text from HTML - strip tags and get readable content
      if (contentType.includes('html') || rawContent.includes('<html') || rawContent.includes('<HTML')) {
        // Remove script, style, and header elements
        filingText = rawContent
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          // Convert tables to readable format
          .replace(/<\/tr>/gi, '\n')
          .replace(/<\/td>/gi, ' | ')
          .replace(/<\/th>/gi, ' | ')
          // Convert common elements
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<\/h[1-6]>/gi, '\n\n')
          // Remove all remaining HTML tags
          .replace(/<[^>]+>/g, ' ')
          // Clean up entities
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/&mdash;/gi, '—')
          .replace(/&ndash;/gi, '–')
          .replace(/&#\d+;/g, '')
          // Normalize whitespace
          .replace(/\s+/g, ' ')
          .replace(/\n\s+/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      } else {
        filingText = rawContent;
      }
      
      // Truncate if too long (keep most important parts - beginning and financial sections)
      const MAX_CHARS = 80000; // ~20k tokens
      if (filingText.length > MAX_CHARS) {
        // Try to find key sections
        const sections = {
          risk: filingText.match(/risk factors[\s\S]{0,15000}/i)?.[0] || '',
          financial: filingText.match(/financial statements[\s\S]{0,15000}/i)?.[0] || '',
          md_a: filingText.match(/management.{0,20}discussion[\s\S]{0,15000}/i)?.[0] || '',
          results: filingText.match(/results of operations[\s\S]{0,10000}/i)?.[0] || ''
        };
        
        // Prioritize key sections, fill with beginning if space remains
        const keyContent = Object.values(sections).filter(Boolean).join('\n\n---\n\n');
        if (keyContent.length > 5000) {
          filingText = filingText.substring(0, 20000) + '\n\n[...truncated...]\n\n' + keyContent.substring(0, MAX_CHARS - 20000);
        } else {
          filingText = filingText.substring(0, MAX_CHARS);
        }
      }
      
    } catch (fetchErr) {
      console.error('Failed to fetch filing:', fetchErr);
      return res.json({ summary: null, error: `Could not fetch filing: ${fetchErr.message}` });
    }
    
    if (filingText.length < 500) {
      return res.json({ summary: null, error: 'Filing content too short or could not be extracted' });
    }
    
    console.log(`Extracted ${filingText.length} chars from filing, sending to AI...`);
    
    const formDescriptions = {
      '10-K': 'Annual Report (comprehensive financial and operational review)',
      '10-Q': 'Quarterly Report (financial update)',
      '8-K': 'Current Report (material events)',
      'DEF 14A': 'Proxy Statement (executive compensation, governance)',
      '13F': 'Institutional Holdings Report'
    };
    
    const prompt = `You are an expert financial analyst. Analyze this SEC ${formType || 'filing'} (${formDescriptions[formType] || ''}) for ${symbol || 'this company'}.

Provide a structured analysis covering:

## Key Highlights
- The 3-5 most important takeaways an investor should know
- Any significant changes from prior periods

## Financial Summary
- Revenue, earnings, margins (with YoY or QoQ changes if available)
- Cash flow and balance sheet health
- Any notable line items or unusual charges

## Risk Factors
- Top 3 risks highlighted in the filing
- Any new risks or changes from prior filings

## Management Commentary
- Key points from management's discussion
- Forward guidance if provided
- Strategic priorities mentioned

## Red Flags & Opportunities
- Anything concerning an investor should watch
- Potential positive catalysts or strengths

Keep the analysis concise but substantive. Use specific numbers from the filing when available. Format with markdown headers and bullet points.

---
FILING CONTENT:
${filingText}`;

    let summary = null;
    
    // Try Claude first
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
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        
        const claudeData = await claudeRes.json();
        
        if (claudeData.content?.[0]?.text) {
          summary = claudeData.content[0].text;
          console.log('SEC filing summarized via Claude');
        } else if (claudeData.error) {
          console.error('Claude error:', claudeData.error);
        }
      } catch (claudeErr) {
        console.error('Claude request failed:', claudeErr.message);
      }
    }
    
    // Fallback to OpenAI
    if (!summary && OPENAI_API_KEY) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.3
          })
        });
        
        const openaiData = await openaiRes.json();
        
        if (openaiData.choices?.[0]?.message?.content) {
          summary = openaiData.choices[0].message.content;
          console.log('SEC filing summarized via OpenAI');
        } else if (openaiData.error) {
          console.error('OpenAI error:', openaiData.error);
        }
      } catch (openaiErr) {
        console.error('OpenAI request failed:', openaiErr.message);
      }
    }
    
    res.json({ summary, filingLength: filingText.length });
    
  } catch (err) {
    console.error('SEC Summarization Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Steele Stock Dashboard running on port ${PORT}`);
  console.log(`APIs configured: Claude=${!!ANTHROPIC_API_KEY}, OpenAI=${!!OPENAI_API_KEY}, Finnhub=${!!FINNHUB_API_KEY}, Perplexity=${!!PERPLEXITY_API_KEY}`);
});
