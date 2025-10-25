    # Gestione Turni P.L. (Vite Edition)

Questa è un'applicazione web progressiva (PWA) progettata per agenti di Polizia Locale per aiutarli a gestire ferie, permessi, straordinari, reperibilità e il proprio ciclo di turni.

Questa versione è stata migrata a **Vite**, un moderno build tool che offre prestazioni superiori e un'esperienza di sviluppo migliorata rispetto alla precedente versione basata su Babel Standalone.

## Descrizione

L'app offre le seguenti funzionalità:
- **Gestione Eventi**: Inserimento e tracciamento di ferie, permessi, straordinari, reperibilità e progetti.
- **Calendario Interattivo**: Visualizzazione di tutti gli eventi e del proprio schema di turni su un calendario mensile.
- **Calcolo Stipendio Stimato**: Un calcolatore per stimare la busta paga lorda mensile.
- **Dashboard Personalizzabile**: Una vista riassuntiva con widget per le informazioni più importanti.
- **Importazione Automatica**: Utilizza l'AI di Google Gemini per analizzare file PDF o Excel e importare automaticamente i turni.
- **Gestione Dati**: Esportazione dei dati per il backup e importazione per il ripristino del profilo.
- **Sincronizzazione Calendario**: Esportazione degli eventi in formato .ics.
- **PWA Ottimizzata**: Funzionalità offline robuste e installabilità garantite dal plugin `vite-plugin-pwa`.

## Installazione e Avvio

Per eseguire questa applicazione in modalità sviluppo, è necessario avere [Node.js](https://nodejs.org/) installato.

1.  **Clona il repository**
    ```bash
    git clone <URL_DEL_TUO_REPOSITORY>
    cd <NOME_DELLA_CARTELLA>
    ```

2.  **Installa le dipendenze**
    ```bash
    npm install
    ```

3.  **Configura la Chiave API**
    - Rinomina il file `.env.example` in `.env.local`.
    - Apri il file `.env.local` e sostituisci `LA_TUA_CHIAVE_API_QUI` con la tua chiave API di Google Gemini.
    ```
    VITE_GEMINI_API_KEY="xxx-yyy-zzz"
    ```
    **Importante**: Il file `.env.local` è già incluso nel `.gitignore` di default di Vite per evitare che la chiave venga accidentalmente committata nel repository.

4.  **Avvia il server di sviluppo**
    ```bash
    npm run dev
    ```
    L'applicazione sarà ora disponibile all'indirizzo `http://localhost:5173` (o un'altra porta se la 5173 è occupata).

## Creazione della Build per la Produzione

Per pubblicare l'applicazione, è necessario creare una build ottimizzata.

1.  **Esegui il comando di build**
    ```bash
    npm run build
    ```
    Questo comando creerà una cartella `dist` nella root del progetto. Questa cartella contiene tutti i file statici (HTML, CSS, JavaScript) ottimizzati e pronti per la pubblicazione.

2.  **Pubblicazione (Deploy)**
    - Carica il contenuto della cartella `dist` su qualsiasi servizio di hosting per siti statici (es. Netlify, Vercel, GitHub Pages).
    - Assicurati che il tuo sito sia servito tramite **HTTPS**, requisito fondamentale per il funzionamento delle PWA (Service Worker, notifiche, etc.).

## Deploy su Vercel

L'applicazione è pronta per essere distribuita su [Vercel](https://vercel.com) con una configurazione full-stack (frontend statico + API serverless Prisma-ready).

### 1. Prerequisiti

- **Database PostgreSQL** accessibile da Vercel (es. Vercel Postgres, Neon, Supabase, Railway, ecc.).
- Schema applicato tramite Prisma:
    ```bash
    npx prisma migrate deploy
    ```
    oppure, in locale prima del push:
    ```bash
    npm run db:migrate
    ```

### 2. Variabili d'ambiente

Configura le seguenti variabili nelle impostazioni del progetto Vercel (Project Settings → Environment Variables):

- `DATABASE_URL` → stringa di connessione PostgreSQL (obbligatoria per Prisma).
- `DIRECT_URL` → opzionale ma consigliata per Prisma con connection pooling.
- `ALLOWED_ORIGINS` → elenco di origini separate da virgola autorizzate a consumare le API (es. `https://tuo-dominio.vercel.app,https://app.tuodominio.it`). In assenza, vengono permessi `http://localhost:5173` e `http://localhost:3000`.
- Qualsiasi altra variabile necessaria (es. `VITE_GEMINI_API_KEY` se vuoi usare l'AI nel frontend). Ricorda che le variabili che iniziano con `VITE_` sono esposte al browser.

Suggerimento: imposta le variabili sia per l'ambiente **Preview** sia per **Production**.

### 3. Collegamento del repository

1. Esegui push del codice su GitHub/GitLab/Bitbucket.
2. Su Vercel crea un nuovo progetto e collega il repository.
3. Vercel rileverà automaticamente il progetto Vite e userà il file `vercel.json` per:
     - eseguire `npm run build`;
     - pubblicare la cartella `dist` come output statico;
     - instradare tutte le route SPA verso `index.html`;
     - esporre l'API Express tramite la funzione serverless `api/index.ts`.

### 4. Deploy

- Ogni push su `main` (o sul branch configurato) avvierà un deploy automatico.
- Per un deploy manuale da locale puoi usare:
    ```bash
    npx vercel --prod
    ```
    (richiede il CLI Vercel configurato con `vercel login`).

### 5. Verifiche dopo il deploy

- Apri l'URL generato da Vercel e assicurati che:
    - la PWA venga caricata senza warning su manifest/service worker;
    - le chiamate a `/api/health`, `/api/auth/register` e `/api/auth/login` rispondano correttamente;
    - gli assets statici (icone, SW) vengano serviti senza cache aggressiva (gestito dal file `vercel.json`).

Se qualcosa non funziona, controlla i log delle funzioni (`Vercel → Functions → Logs`) e le variabili d'ambiente.

## Sicurezza della Chiave API

In questa architettura basata su Vite, la chiave API viene gestita tramite **variabili d'ambiente**. La chiave viene inclusa nel codice JavaScript durante il processo di `build`.

**ATTENZIONE**: Sebbene questo metodo sia standard per lo sviluppo, la chiave API sarà comunque visibile a chiunque ispezioni i file JavaScript dell'applicazione pubblicata.

### Approccio Consigliato per la Massima Sicurezza in Produzione
Per una sicurezza a prova di furto, è fortemente raccomandato l'uso di un **backend proxy**. Questo approccio, descritto anche nella versione precedente del README, consiste nel creare un piccolo servizio server che gestisca la chiave API e faccia da intermediario tra la tua app e l'API di Gemini. In questo scenario, il frontend non conterrebbe mai la chiave API.
