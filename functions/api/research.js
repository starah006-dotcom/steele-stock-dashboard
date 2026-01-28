// Deep research endpoint using Perplexity
export async function onRequestPost(context) {
  const { request, env } = context;
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    const { symbol, query } = await request.json();
    const PERPLEXITY_API_KEY = env.PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ research: null }), { headers });
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
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800
      })
    });

    const data = await pplxRes.json();
    const research = data.choices?.[0]?.message?.content || null;
    
    return new Response(JSON.stringify({ research }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ research: null, error: err.message }), { headers });
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
