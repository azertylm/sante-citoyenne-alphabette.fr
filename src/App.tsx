import { AppShell } from '@alphabette/shell';
import '@alphabette/shell/style.css';
import { APP } from './alphabette.app';

/**
 * Santé Citoyenne — Prévention douce et entraide, près de chez vous
 *
 * La base commune (deux barres, thème jour/nuit, densité, plein écran) est
 * fournie par <AppShell>. Le contenu de l'application se construit à
 * l'intérieur.
 */
export function App() {
  return (
    <AppShell app={APP}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
          Santé Citoyenne
        </h1>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>
          Bienvenue. Le contenu de l’application se construit ici.
        </p>
      </div>
    </AppShell>
  );
}
