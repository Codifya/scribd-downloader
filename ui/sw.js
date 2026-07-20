const CACHE_NAME = 'lifinize-cache-v3'
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/adblock.js',
  '/consent.js',
  '/privacy.html',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/favicon.png',
  '/assets/logo.svg'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE)
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API calls: Network first, no cache
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Static assets: Cache first, fall back to network
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    })
  )
})

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})
