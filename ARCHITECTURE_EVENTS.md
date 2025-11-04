# Architettura Eventi - Disaccoppiamento Completo

## Panoramica

Gli eventi (ferie, permessi, straordinari, reperibilità, progetti, appuntamenti) sono stati completamente disaccoppiati dal blob del profilo e ora sono gestiti esclusivamente tramite l'endpoint unificato `/api/events`.

## Flusso Dati

### 1. Salvataggio Eventi

```
Utente → UI Component → handleSaveEvent() 
  ↓
  ├─ Aggiornamento stato locale (reattività immediata)
  └─ POST/PUT /api/events (persistenza asincrona)
       ↓
       Database (tabella events)
```

**Codice:** `src/MainApp.tsx` - `handleSaveEvent()`
- Aggiorna immediatamente lo stato locale per reattività UI
- Chiama `eventsApiService.upsert()` o `.update()` in background
- Gestisce errori con alert user-friendly
- **Eccezione:** Eventi "Presenza" (derivati da check-in) non vengono mai salvati su /api/events

### 2. Eliminazione Eventi

```
Utente → UI Component → handleDeleteEntry()
  ↓
  ├─ Rimozione da stato locale (reattività immediata)
  └─ DELETE /api/events?id=xxx (persistenza asincrona)
       ↓
       Database (tabella events)
```

**Codice:** `src/MainApp.tsx` - `handleDeleteEntry()`
- Rimuove immediatamente dallo stato locale
- Chiama `eventsApiService.remove()` in background
- **Eccezione:** Eventi "Presenza" eliminano anche i check-in tramite `/api/checkin`

### 3. Sincronizzazione Multi-Dispositivo

```
Timer (10s) + visibilityChange → fetchAndApply()
  ↓
  GET /api/events → Database
  ↓
  fromServer() mapper → Tipizzazione locale
  ↓
  Confronto ID (evita aggiornamenti inutili)
  ↓
  setHolidays/setPermits/etc (merge con presenze locali)
```

**Codice:** `src/MainApp.tsx` - `useEffect` sync eventi
- Polling ogni 10 secondi
- Sync immediato quando la tab torna visibile
- Confronto intelligente per evitare re-render inutili (confronto ID, non intero oggetto)
- Mantiene sempre le "Presenza" locali generate dai check-in

### 4. Profilo (Solo Metadati)

```
handleUpdateProfileData() → profileApiService.saveProfile()
  ↓
  Filtra TUTTI gli eventi dal payload
  ↓
  POST /api/profile (solo: shiftOverrides, workLocation, checkIns, settings, etc.)
```

**Codice:** `src/App.tsx` - `handleUpdateProfileData()`
- Rimuove `holidays`, `permits`, `overtime`, `onCall`, `projects`, `appointments` prima del salvataggio
- Il profilo contiene solo:
  - Pattern turni e override
  - Impostazioni salariali
  - Posizione di lavoro
  - Check-in (timestamp grezzi, non gli appuntamenti "Presenza")
  - Configurazioni UI (filtri, card collapse, etc.)

## Mapping Eventi

### Client → Server (toPayload)

**File:** `src/services/eventsMapper.ts`

Converte i tipi locali TypeScript (`HolidayEntry`, `PermitEntry`, etc.) in payload generico:

```typescript
{
  id: string,
  date: string,      // YYYY-MM-DD
  type: string,      // ferie | permessi | straordinario | reperibilita | progetto | appuntamento
  title: string,
  extra: {           // Campi specifici per tipo
    value?: number,
    startTime?: string,
    endTime?: string,
    category?: string,
    // ... altri campi tipo-specifici
  }
}
```

### Server → Client (fromServer)

**File:** `src/services/eventsMapper.ts`

Converte il payload generico del server nei tipi locali fortemente tipizzati:

```typescript
Server Event → fromServer() → HolidayEntry | PermitEntry | ... | AppointmentEntry
```

Gestisce valori di default per campi opzionali e garantisce la type-safety.

## Tabella Database

**Prisma Schema:** `prisma/schema.prisma`

```prisma
model Event {
  id          String    @id @default(dbgenerated("(gen_random_uuid())::text"))
  userId      String
  title       String
  date        DateTime  @db.Timestamp(6)
  type        String
  status      String?   @default("pending")
  description String?   // JSON serializzato dei campi extra
  createdAt   DateTime? @default(now())
  updatedAt   DateTime? @default(now()) @updatedAt
  user        User      @relation(...)
}
```

- `description`: contiene JSON con campi extra tipo-specifici
- `updatedAt`: usato per sync incrementali (futura ottimizzazione)

## Service Layer

### eventsApiService.ts

Client HTTP per l'endpoint `/api/events`:

```typescript
- list(since?): Promise<Event[]>        // GET con filtro opzionale
- upsert(event): Promise<Event>         // POST (create/update)
- update(event): Promise<Event>         // PUT
- remove(id): Promise<boolean>          // DELETE
```

Gestisce:
- Header `Authorization: Bearer <token>`
- Serializzazione/deserializzazione JSON
- Gestione errori HTTP

## Casi Speciali

### Eventi "Presenza"

**Caratteristiche:**
- `type: 'appuntamento'`
- `title: 'Presenza'`
- Derivati da coppie check-in entrata/uscita
- **NON salvati** su `/api/events`
- **NON salvati** nel blob del profilo
- Rigenerati dinamicamente dai check-in ogni volta

**Flusso:**
```
Check-in entrata/uscita → /api/checkin (database)
  ↓
fetchCheckInsAndSyncAppointments() (polling 5s)
  ↓
Raggruppa per giorno → Crea AppointmentEntry "Presenza"
  ↓
setAppointments() (solo in memoria locale)
```

### Check-in NFC

**Flusso separato:**
```
Lettura NFC → handleAddCheckIn()
  ↓
  ├─ POST /api/checkin (persistenza entrata/uscita)
  └─ Aggiorna stato locale checkIns
       ↓
       fetchCheckInsAndSyncAppointments() (dopo 2s)
       ↓
       Genera "Presenza" in memoria
```

## Vantaggi Architettura

### ✅ Pro

1. **Sincronizzazione Affidabile**
   - Fonte unica della verità: `/api/events`
   - Nessun conflitto da merge blob JSON
   - Aggiornamenti atomici per evento

2. **Scalabilità**
   - Query incrementali possibili (`?since=timestamp`)
   - Indicizzazione DB su userId + date + type
   - Ridotto payload profilo (solo metadati)

3. **Type Safety**
   - Mapper bidirezionale con validazione
   - Type guard su campi obbligatori
   - Default intelligenti per backward compatibility

4. **Manutenibilità**
   - Logica eventi centralizzata
   - Facile aggiungere nuovi tipi evento
   - Debug semplificato (log strutturati)

### ⚠️ Considerazioni

1. **Latenza Iniziale**
   - Primo caricamento richiede 2 call (profilo + eventi)
   - Mitigato da: aggiornamento locale immediato + sync asincrona

2. **Gestione Offline**
   - Eventi modificati offline vanno in coda
   - Attualmente: fallimento silenzioso con log
   - Futura evoluzione: coda retry con IndexedDB

3. **Migrazione Dati Esistenti**
   - Profili legacy potrebbero avere eventi nel blob
   - Non gestito automaticamente (da fare su richiesta)
   - Strategia: repair endpoint che legge dal blob e popola `/api/events`

## Testing

### Test Manuali

1. **Salvataggio evento:**
   ```
   Aggiungi ferie → Verifica stato locale → Apri DevTools Network
   → Conferma POST /api/events → Refresh pagina → Verifica persistenza
   ```

2. **Sync cross-device:**
   ```
   Dispositivo A: aggiungi permesso
   Dispositivo B: attendi 10s (o cambia tab e torna)
   → Verifica comparsa permesso su B
   ```

3. **Eliminazione:**
   ```
   Elimina straordinario → Verifica scomparsa locale
   → Controlla DELETE in Network → Refresh → Conferma eliminazione persistita
   ```

4. **Presenza NFC:**
   ```
   Check-in entrata → Check-in uscita → Verifica "Presenza" in calendario
   → Elimina presenza → Conferma cancellazione check-in da DB
   ```

## Log & Debug

### Console Logs Significativi

- `📤 Salvataggio evento su /api/events: ferie (nuovo)` - Invio a server
- `✅ Evento salvato su /api/events con successo` - Conferma persistenza
- `🔄 Sync da /api/events: ricevuti X eventi` - Polling sync attivo
- `📊 Eventi mappati: ferie: 3, permessi: 5, ...` - Breakdown dopo mapping
- `✅ Eventi aggiornati da /api/events` - Stato locale aggiornato
- `⚠️ Lettura eventi da /api/events fallita:` - Errore rete/auth

### Debugging Tips

1. **Eventi non sincronizzati:**
   - Controlla JWT valido (`localStorage.getItem('turni_pl_auth_token')`)
   - Verifica Network tab per status code `/api/events`
   - Controlla `userId` corretto nei record DB

2. **Presenze mancanti:**
   - Verifica polling check-in attivo (log ogni 5s)
   - Controlla `/api/checkin` per coppie entrata/uscita
   - Valida timestamp nello stesso giorno

3. **Salvataggio fallito:**
   - Alert user appare su errore critico
   - Log console mostra stack trace completo
   - Verifica Prisma connection attiva (log `error`/`warn`)

## Prossimi Passi (Opzionali)

1. **Migrazione dati legacy:**
   - Endpoint `/api/events/migrate` che legge eventi dal profilo blob
   - Popola tabella events
   - Svuota blob profilo

2. **Sync incrementale:**
   - Usa parametro `?since=<lastUpdatedAt>`
   - Riduce payload per utenti con molti eventi

3. **Offline support:**
   - Service Worker intercetta fallimenti
   - Accoda in IndexedDB
   - Retry automatico al ritorno online

4. **Ottimizzazioni performance:**
   - Lazy load eventi per anno/mese
   - Virtual scrolling per liste lunghe
   - Memoization più aggressiva

## Conclusione

Il disaccoppiamento completo degli eventi dal profilo garantisce una sincronizzazione multi-dispositivo robusta e scalabile, eliminando i conflitti di merge e semplificando la logica di persistenza. L'architettura è pronta per evoluzioni future come sync offline e ottimizzazioni incrementali.
