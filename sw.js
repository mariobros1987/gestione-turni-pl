const CACHE_NAME = 'gestione-turni-pl-cache-v4';
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'index.css',
  'index.tsx',
  'offline.html', // Pagina di fallback
  // Aggiungo tutte le icone alla cache per una PWA pienamente funzionale offline
  'icon-128.png',
  'icon-192.png',
  'icon-256.png',
  'icon-512.png'
];

self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('fetch', event => {
  // Ignora le richieste che non sono GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // NON intercettare:
  // 1. Richieste API (backend)
  // 2. Richieste con parametri NFC (?azione, ?auto)
  // 3. Richieste verso domini esterni
  if (
    url.pathname.startsWith('/api/') ||
    url.searchParams.has('azione') ||
    url.searchParams.has('auto') ||
    url.origin !== location.origin
  ) {
    // Passa direttamente alla rete senza cache
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Non in cache, esegui il fetch dalla rete
        return fetch(event.request).catch(() => {
          // Se la richiesta di rete fallisce, restituisci la pagina di fallback offline
          // ma solo per navigazioni HTML, non per asset
          if (event.request.headers.get('accept')?.includes('text/html')) {
            console.error('Network request failed for:', event.request.url);
            return caches.match('offline.html');
          }
        });
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Eliminazione delle cache obsolete per forzare l'aggiornamento
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});