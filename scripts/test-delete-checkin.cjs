(async () => {
  try { require('dotenv').config(); } catch {}
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const email = process.env.E2E_EMAIL || 'admin@localhost';
  const password = process.env.E2E_PASSWORD || 'admin123';
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'gestione-turni-secret-key-2024';

  const today = new Date().toISOString().split('T')[0];

  let token;
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) { const data = await res.json(); token = data.token; }
  } catch {}
  if (!token) {
    const usersRes = await fetch(`${baseUrl}/api/users`);
    const usersData = await usersRes.json();
    const user = usersData?.users?.find(u => u.email==='admin@localhost') || usersData?.users?.[0];
    token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  }

  const delRes = await fetch(`${baseUrl}/api/checkin`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ date: today })
  });
  const delTxt = await delRes.text();
  console.log('[test-delete-checkin] status', delRes.status, 'body:', delTxt);
  process.exit(0);
})().catch(err => { console.error('[test-delete-checkin] ERR', err?.message || err); process.exit(1); });