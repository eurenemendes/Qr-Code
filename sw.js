
const CACHE_NAME = 'qr-master-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // Não cachear chamadas da API do Google GenAI
          if (!event.request.url.includes('generativelanguage.googleapis.com')) {
            cache.put(event.request, fetchResponse.clone());
          }
          return fetchResponse;
        });
      });
    }).catch(() => {
        // Fallback para quando estiver offline e o recurso não estiver no cache
        if (event.request.mode === 'navigate') {
            return caches.match('/');
        }
    })
  );
});
