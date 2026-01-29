// Deep research endpoint using Perplexity
export async function onRequestPost(context) {
  const { request, env } = context;
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  };

  try {
    const body = await request.json();
    const { symbol, query, task, filingUrl, filingType } = body;
    const PERPLEXITY_API_KEY = env.PERPLEXITY_API_KEY;
    
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ research: null }), { headers });
    }

    let prompt;
    
    if (task === 'twitter_sentiment') {
      // Search X/Twitter for stock sentiment
      prompt = `Search X (Twitter) for recent posts about $${symbol} stock from the last 24-48 hours.

Summarize:
1. **Overall Sentiment** - Is the buzz bullish, bearish, or mixed?
2. **Key Influencer Takes** - What are notable traders/analysts saying?
3. **Trending Topics** - What specific news/events are people discussing?
4. **Volume/Engagement** - Is there unusual activity or trending hashtags?

Include specific quotes or paraphrased takes where notable. Flag any rumors or unverified claims.`;
    } else if (task === 'summarize_filing') {
      // Summarize SEC filing
      prompt = `Analyze the SEC ${filingType} filing for ${symbol} (${filingUrl}).

Provide a concise executive summary covering:
1. **Key Financial Highlights** - Revenue, earnings, margins, and YoY changes
2. **Business Updates** - Major announcements, strategic initiatives, acquisitions
3. **Risk Factors** - New or elevated risks mentioned
4. **Forward Guidance** - Management's outlook and projections
5. **Notable Changes** - Significant changes from prior periods

Focus on information that would impact investment decisions. Be specific with numbers where available.`;
    } else {
      // Standard stock research
      prompt = query || `Provide a brief investment research summary for ${symbol}. Include:
1. Recent news and developments (last 7 days)
2. Analyst sentiment and price targets
3. Key risks to watch
4. Upcoming catalysts (earnings, events)
Keep it concise and actionable for an investor.`;
    }

    const pplxRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: task === 'summarize_filing' ? 1200 : 800
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
