# Fix Check-in NFC non visualizzato nel calendario

## Problemi risolti

1. **Schema Prisma**: Aggiornato il modello `CheckIn` con i campi corretti (`type`, `serialNumber`, `rawPayload`)
2. **API Check-in**: Reso `serialNumber` opzionale (solo `type` e `timestamp` sono obbligatori)
3. **NfcCheckInButton**: Rimossa duplicazione della logica di registrazione

## Passaggi per il deploy su Vercel

### 1. Aggiorna il database Supabase

Vai su **Supabase Dashboard** → **SQL Editor** ed esegui lo script:

```sql
-- Migrazione per aggiornare la tabella checkin
ALTER TABLE checkin RENAME COLUMN azione TO type;
ALTER TABLE checkin RENAME COLUMN tag_content TO "rawPayload";
ALTER TABLE checkin ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
```

### 2. Committa e pusha i cambiamenti

```bash
git add .
git commit -m "Fix: corretto schema check-in NFC per visualizzazione nel calendario"
git push origin main
```

### 3. Verifica il deploy su Vercel

Vercel rebuilderà automaticamente l'app. Verifica che:
- Il deploy sia completato con successo
- Le timbrature NFC vengano salvate correttamente
- Gli eventi appaiano nel calendario

## File modificati

- `prisma/schema.prisma`: Modello CheckIn aggiornato
- `api/checkin/index.ts`: Validazione input corretta
- `src/components/NfcCheckInButton.tsx`: Rimossa duplicazione logica
- `.env`: Rimosso NODE_ENV e aggiunte variabili VITE_SUPABASE_*

## Test locale

Prima del deploy, testa in locale:

```bash
npm run dev
```

Prova sia la timbratura manuale che quella NFC/simulata e verifica che entrambe creino eventi nel calendario.
