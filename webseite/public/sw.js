// Service Worker: lädt die App blitzschnell aus dem Zwischenspeicher und macht
// sie offline nutzbar. Daten (api.github.com) werden nie hier gespeichert –
// die liegen in IndexedDB und kommen frisch von GitHub.
const CACHE = 'salon-v1'
const SCOPE = new URL(self.registration.scope)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([SCOPE.href, `${SCOPE.href}manifest.webmanifest`])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const anfrage = e.request
  if (anfrage.method !== 'GET') return
  const url = new URL(anfrage.url)
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return

  // Seite selbst: erst Netz (neueste Fassung), sonst Zwischenspeicher.
  if (anfrage.mode === 'navigate') {
    e.respondWith(
      fetch(anfrage)
        .then((antwort) => {
          const kopie = antwort.clone()
          caches.open(CACHE).then((c) => c.put(SCOPE.href, kopie))
          return antwort
        })
        .catch(() => caches.match(SCOPE.href)),
    )
    return
  }

  // Dateien mit Hash im Namen ändern sich nie: Zwischenspeicher zuerst.
  e.respondWith(
    caches.match(anfrage).then(
      (treffer) =>
        treffer ||
        fetch(anfrage).then((antwort) => {
          if (antwort.ok) {
            const kopie = antwort.clone()
            caches.open(CACHE).then((c) => c.put(anfrage, kopie))
          }
          return antwort
        }),
    ),
  )
})
