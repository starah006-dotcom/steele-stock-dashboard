// Auth middleware for password protection
const LOGIN_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
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
    .error { color: #ef4444; font-size: 13px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>🔒 Steele Portfolio</h1>
    <p>Enter password to access</p>
    <div id="error" class="error" style="display:none">Incorrect password</div>
    <form id="loginForm">
      <input type="password" id="password" placeholder="Password" autofocus required>
      <button type="submit">Access Dashboard</button>
    </form>
  </div>
  <script>
    document.getElementById('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: document.getElementById('password').value })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        document.getElementById('error').style.display = 'block';
      }
    };
  </script>
</body>
</html>`;

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  
  // Allow auth endpoint without auth
  if (url.pathname === '/api/auth') {
    return next();
  }
  
  // Check auth cookie
  const cookie = request.headers.get('Cookie') || '';
  if (cookie.includes('auth=authenticated')) {
    const response = await next();
    // Add no-cache headers to prevent stale content
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    newHeaders.set('Pragma', 'no-cache');
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  }
  
  // Allow API calls with valid auth (for AJAX requests)
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Show login page
  return new Response(LOGIN_HTML, {
    headers: { 'Content-Type': 'text/html' }
  });
}
