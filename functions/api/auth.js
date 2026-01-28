// Auth endpoint
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { password } = await request.json();
    const SITE_PASSWORD = env.SITE_PASSWORD || 'Steele813';
    
    if (password === SITE_PASSWORD) {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'auth=authenticated; Path=/; HttpOnly; Max-Age=86400; SameSite=Strict'
        }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
