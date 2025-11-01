# 🚀 Checklist Deploy Produzione - Gestione Turni PL

## ✅ Modifiche Completate

### 1. Endpoint API `/api/checkin` (GET/POST/DELETE)
- **GET**: Recupera check-in dell'utente autenticato
- **POST**: Crea nuovo check-in (entrata/uscita)
- **DELETE**: Cancella check-in di una data specifica

### 2. Correzioni Frontend
- **Polling check-in**: Ora usa API `/api/checkin` invece di query diretta Supabase (risolve RLS)
- **Eliminazione Presenza**: Mostra conferma e cancella check-in server-side
- **Generazione Presenza**: Crea automaticamente evento "Presenza" da entrata+uscita

### 3. Logica Ore Lavorate
- **Soglia corretta a 6 ore**: 
  - Ore > 6 = Straordinario
  - Ore < 6 = Permesso
  - (Prima era 8 ore, ora 6)

---

## 🔧 Variabili Ambiente Vercel

Verifica che queste variabili siano impostate su Vercel (Settings → Environment Variables):

```env
# Database (OBBLIGATORIO - pooler porta 6543)
DATABASE_URL=postgresql://postgres.uzjrbebtanilxxxrsfpj:040787Milan$!@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1

# Supabase (OBBLIGATORIO per API serverless)
SUPABASE_URL=https://uzjrbebtanilxxxrsfpj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6anJiZWJ0YW5pbHh4eHJzZnBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA5NDAyMSwiZXhwIjoyMDc1NjcwMDIxfQ.8rbJGQcyNdPIe0YX-fNIM3w5qCsDh9Kuv-YeKJXCDxw

# JWT Secret
JWT_SECRET=gestione-turni-super-secret-key-2024-production

# Client (VITE_* per frontend)
VITE_SUPABASE_URL=https://uzjrbebtanilxxxrsfpj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6anJiZWJ0YW5pbHh4eHJzZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTQwMjEsImV4cCI6MjA3NTY3MDAyMX0.9xy-ANVedYYC3ux2SVSQEoMXx5dC-iFa_mkcPAhWjmI
VITE_GEMINI_API_KEY=AIzaSyBLI2Gaf3jw9E0TiBbwqYTu_CK13lK-MMc

# CORS
ALLOWED_ORIGINS=https://gestione-turni-pl.vercel.app,https://gestione-turni-p1r8mxggq-marios-projects-dad1128c.vercel.app
```

---

## 📝 Comandi Deploy

### Deploy via Vercel CLI
```bash
# 1. Installa Vercel CLI (se non già installato)
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod
```

### Deploy via Git Push
```bash
# 1. Commit modifiche
git add .
git commit -m "feat: aggiunto GET/DELETE /api/checkin, fix soglia 6 ore, conferma eliminazione presenza"

# 2. Push su main (auto-deploy su Vercel se configurato)
git push origin main
```

---

## ✅ Verifiche Post-Deploy

### 1. Health Check
```bash
curl https://gestione-turni-pl.vercel.app/api/health
# Atteso: {"status":"OK","timestamp":"..."}
```

### 2. Test Login
```bash
curl -X POST https://gestione-turni-pl.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localhost","password":"admin123"}'
# Atteso: {"success":true,"token":"...","user":{...}}
```

### 3. Test GET Check-in
```bash
# Usa il token ottenuto dal login
curl https://gestione-turni-pl.vercel.app/api/checkin \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
# Atteso: {"success":true,"checkIns":[...]}
```

### 4. Test POST Check-in
```bash
curl -X POST https://gestione-turni-pl.vercel.app/api/checkin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"type":"entrata","timestamp":"2025-11-01T08:00:00Z","serialNumber":"TEST"}'
# Atteso: {"success":true,"checkIn":{...}}
```

### 5. Test DELETE Check-in
```bash
curl -X DELETE https://gestione-turni-pl.vercel.app/api/checkin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"date":"2025-11-01"}'
# Atteso: {"success":true}
```

### 6. Verifica Browser
1. Apri https://gestione-turni-pl.vercel.app
2. Effettua login
3. Registra entrata (NFC o bottone)
4. Registra uscita dopo almeno 7 ore
5. Verifica che compaia "Presenza" e calcoli straordinario (ore > 6)
6. Elimina "Presenza" → deve chiedere conferma
7. Ricarica pagina → "Presenza" non deve ricomparire

---

## 🐛 Troubleshooting

### Errore 500 su `/api/checkin`
- Verifica `SUPABASE_SERVICE_ROLE_KEY` su Vercel
- Controlla `DATABASE_URL` (deve essere porta 6543 con pgbouncer)

### Check-in non compaiono
- Verifica che il polling sia attivo (15s)
- Controlla Network tab per errori 401/403
- Verifica token JWT in localStorage: `turni_pl_auth_token`

### "Presenza" ricompare dopo eliminazione
- Verifica che DELETE /api/checkin ritorni 200
- Controlla che i check-in siano effettivamente cancellati dal DB

---

## 📊 Statistiche Modifiche

- **File modificati**: 4
  - `api/checkin.ts` (GET + DELETE)
  - `src/server.backup/app.ts` (GET + DELETE locale)
  - `src/MainApp.tsx` (polling + conferma eliminazione)
  - `src/components/NfcCheckInButton.tsx` (soglia 6 ore)
  
- **Nuovi endpoint**: 2 (GET, DELETE su `/api/checkin`)
- **Test scripts**: 2 (`test-get-checkin.cjs`, `test-delete-checkin.cjs`)
- **Linee cambiate**: ~150

---

## 🎯 Prossimi Passi (Opzionale)

- [ ] Aggiungere paginazione per GET /api/checkin se gli utenti hanno molti check-in
- [ ] Implementare soft-delete invece di delete permanente per audit
- [ ] Aggiungere export CSV/PDF dei check-in
- [ ] Dashboard statistiche check-in mensili

---

Generato il: 1 novembre 2025
