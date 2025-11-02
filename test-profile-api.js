// Test API /api/profile
// Esegui con: node test-profile-api.js

const fetch = require('node-fetch');

const API_URL = 'https://gestione-turni-m4gck9rzu-marios-projects-dad1128c.vercel.app/api/profile';
const TOKEN = 'INSERISCI_TOKEN_VALIDO'; // Sostituisci con un JWT valido

async function testGetProfile() {
  const res = await fetch(API_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  console.log('GET /api/profile:', data);
}

async function testPostProfile() {
  const profile = {
    nome: 'Mario',
    cognome: 'Di Benedetto',
    email: 'mario@example.com',
    // ...altri campi profilo...
  };
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profile }),
  });
  const data = await res.json();
  console.log('POST /api/profile:', data);
}

(async () => {
  await testGetProfile();
  await testPostProfile();
})();
