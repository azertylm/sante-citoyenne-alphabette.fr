/**
 * Santé Citoyenne — service worker (mode hors-ligne).
 *
 * Stratégie simple mais honnête :
 *   · les documents et les ressources de l'application sont mis en cache au
 *     fil de la navigation (runtime), le précache ne garde que la coquille ;
 *   · les demandes hors-ligne sont servies depuis le cache — l'app entière
 *     (journal, roue, pochette) fonctionne sans réseau, puisque TOUTES les
 *     données vivent dans le localStorage de l'appareil ;
 *   · l'API du hub (/api) n'est JAMAIS mise en cache : elle reste en ligne,
 *     et la base commune sait replier tout seule si elle est injoignable.
 */
const CACHE = 'sante-citoyenne-v1';
const COQUILLE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(COQUILLE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;      // externe : pas cache
  if (url.pathname.startsWith('/api/')) return;          // hub : toujours réseau

  // Navigation : réseau d'abord (mises à jour propres), cache au cas où.
  if (requete.mode === 'navigate') {
    event.respondWith(
      fetch(requete)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copie));
          return reponse;
        })
        .catch(() =>
          caches.match(requete).then((vue) => vue || caches.match('/index.html')),
        ),
    );
    return;
  }

  // Ressources (script, style, icônes) : d'abord le cache, sinon réseau + mise en cache.
  event.respondWith(
    caches.match(requete).then((aussitot) => {
      if (aussitot) return aussitot;
      return fetch(requete).then((reponse) => {
        if (reponse && reponse.ok && reponse.type === 'basic') {
          const copie = reponse.clone();
          caches.open(CACHE).then((c) => c.put(requete, copie));
        }
        return reponse;
      });
    }),
  );
});
