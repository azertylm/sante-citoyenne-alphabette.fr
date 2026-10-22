import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/* Mode hors-ligne : le service worker ne s'enregistre qu'en production —
 * en développement le serveur Vite gère lui-même le rechargement, et jamais
 * il ne faut risquer de servir une page périmée pendant les essais.
 * Il est enregistré sans bruit : s'il échoue, l'app marche pareil (en ligne). */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* pas de service worker : application utilisable normalement en ligne */
    });
  });
}
