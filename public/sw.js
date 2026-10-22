// Service worker de MAHER
// Lo justo para que la app se pueda instalar en el móvil.
// Siempre va primero a internet (así nunca ves una versión vieja);
// solo si no hay conexión enseña la última pantalla guardada.
const CACHE = 'maher-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.add('/')).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  // Solo la página principal; los datos (Supabase) y el resto pasan sin tocar
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  e.respondWith(
    fetch(req)
      .then(res => {
        const copia = res.clone()
        caches.open(CACHE).then(c => c.put('/', copia)).catch(() => {})
        return res
      })
      .catch(() => caches.match('/'))
  )
})
