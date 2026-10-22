import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * La base commune (@alphabette/shell) est embarquée dans src/shell :
 * l'alias résout son nom de paquet vers cette copie, synchronisée depuis le
 * dépôt du hub par `bun run new:app` (et `bun run sync:shell`).
 *
 * Ne jamais recoder les barres du haut à la main : elles viennent de la base.
 */
const shellDir = path.resolve('src/shell');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // L'alias le plus précis d'abord : la feuille de style de la base.
      '@alphabette/shell/style.css': path.resolve(shellDir, 'shell.css'),
      '@alphabette/shell': path.resolve(shellDir, 'index.ts'),
    },
  },
  server: {
    port: 5173,
    // En développement, le registre des applications (et le reste de l'API)
    // vit dans le hub local : on le relaie pour éviter tout problème de CORS.
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
