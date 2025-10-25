// Script Node.js per testare la connessione a PostgreSQL (Supabase)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = "postgresql://postgres.uzjrbebtanilxxxrsfpj:040787Milan%24%21@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require";

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

client.connect()
  .then(() => {
    console.log('✅ Connessione al database riuscita!');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('Risposta dal DB:', res.rows[0]);
  })
  .catch(err => {
    console.error('❌ Errore di connessione:', err.message);
  })
  .finally(() => client.end());
