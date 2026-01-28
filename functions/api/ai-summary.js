// AI Summary endpoint using Claude
export async function onRequestPost(context) {
  const { request, env } = context;
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    const { stocks } = await request.json();
    const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ summary: null }), { headers });
    }

    const stockSummaries = stocks.map(s => {
      let info = `${s.symbol} (${s.name}): $${s.price?.toFixed(2)}, ${s.changePercent >= 0 ? '+' : ''}${s.changePercent?.toFixed(1)}% today`;
      if (s.gainPct !== undefined) info += `, ${s.gainPct >= 0 ? '+' : ''}${s.gainPct?.toFixed(0)}% total gain`;
      if (s.yield) info += `, ${s.yield.toFixed(1)}% yield`;
      if (s.exDivDays !== null && s.exDivDays >= 0 && s.exDivDays <= 30) info += `, ex-div in ${s.exDivDays} days`;
      if (s.articles?.length) info += `. Headlines: ${s.articles.slice(0, 2).join('; ')}`;
      return info;
    }).join('\n');

    const prompt = `You are a concise investment analyst. Analyze this portfolio and provide 4-6 actionable insights.

Focus on:
1. Concerning news (bearish signals) - FLAG PROMINENTLY
2. Upcoming ex-dividend dates
3. Notable price movements today
4. Positions significantly outperforming or underperforming
5. Risk observations

Format each insight as HTML:
- Stock tickers: <span class="stock-ticker">SYMBOL</span>
- Bullish: <span class="bullish">text</span>
- Bearish: <span class="bearish">text</span>
- Wrap each in: <div class="stock-insight">...</div>

Portfolio (${stocks.length} positions):
${stockSummaries}`;

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
    let summary = claudeData.content?.[0]?.text || null;
    
    if (summary) {
      summary = summary.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    return new Response(JSON.stringify({ summary }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ summary: null, error: err.message }), { headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
