(async () => {
  try { require('dotenv').config(); } catch {}
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const email = process.env.E2E_EMAIL || 'admin@localhost';
  const password = process.env.E2E_PASSWORD || 'admin123';
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024';

  let token;
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      const data = await res.json();
      token = data.token;
      console.log('[test-get-checkin] Login OK for', data?.user?.email);
    } else {
      console.warn('[test-get-checkin] Login failed with', res.status);
    }
  } catch (e) {
    console.warn('[test-get-checkin] Login request error:', e?.message || e);
  }

  if (!token) {
    // fallback sign
    const usersRes = await fetch(`${baseUrl}/api/users`);
    const usersData = await usersRes.json();
    const user = usersData?.users?.[0];
    token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    console.log('[test-get-checkin] using signed token for', user.email);
  }

  const r = await fetch(`${baseUrl}/api/checkin`, { headers: { Authorization: `Bearer ${token}` } });
  const txt = await r.text();
  console.log('[test-get-checkin] status', r.status, 'body:', txt);
  process.exit(0);
})().catch(err => { console.error('[test-get-checkin] ERR', err?.message || err); process.exit(1); });