process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uzjrbebtanilxxxrsfpj:040787Milan$!@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1';

const client = new Client({
  connectionString,
});

client.connect()
  .then(() => {
    console.log('✅ Connessione pooler riuscita!');
    return client.end();
  })
  .catch((err) => {
    console.error('❌ Errore connessione pooler:', err.message);
    process.exit(1);
  });
