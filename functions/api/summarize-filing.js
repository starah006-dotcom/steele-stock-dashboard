// SEC Filing Summarization - fetches and analyzes actual filing content
export async function onRequestPost(context) {
  const { env, request } = context;
  
  try {
    const { filingUrl, formType, symbol } = await request.json();
    
    if (!filingUrl) {
      return Response.json({ error: 'Filing URL required' }, { status: 400 });
    }
    
    const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
    const OPENAI_API_KEY = env.OPENAI_API_KEY;
    
    if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
      return Response.json({ summary: null, error: 'No AI API key configured' });
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
      return Response.json({ summary: null, error: `Could not fetch filing: ${fetchErr.message}` });
    }
    
    if (filingText.length < 500) {
      return Response.json({ summary: null, error: 'Filing content too short or could not be extracted' });
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
    
    return Response.json({ summary, filingLength: filingText.length });
    
  } catch (err) {
    console.error('SEC Summarization Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
