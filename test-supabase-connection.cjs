// Script Node.js per testare la connessione al pooler Supabase (pgbouncer, porta 6543)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

// Usa la porta 6543 con pgbouncer e sslmode=require
const connectionString = 'postgresql://postgres.uzjrbebtanilxxxrsfpj:040787Milan$!@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

client.on('error', (err) => {
  console.error('⚠️  Client error:', err.message);
});

client
  .connect()
  .then(() => client.query('SELECT NOW() AS now'))
  .then((res) => {
    console.log('✅ Connessione al pooler riuscita! NOW =', res.rows[0].now);
  })
  .catch((err) => {
    console.error('❌ Errore di connessione:', err.message);
  })
  .finally(() => client.end());
