# Santé Citoyenne

**Prévention douce et entraide, près de chez vous**

Application de l'écosystème [alphabette.fr](https://alphabette.fr).

- Adresses : **https://santecitoyenne.alphabette.fr** (sous-domaine) et
  **https://alphabette.fr/sante-citoyenne** (chemin).
- Base commune : [`@alphabette/shell`](https://alphabette.fr) — les deux barres du
  haut (écosystème + application), le thème jour/nuit, la densité et le plein écran.

## Démarrer

```powershell
bun install
bun run dev
```

## Structure

```
src/
  main.tsx            point d'entrée
  App.tsx             application enveloppée par <AppShell>
  alphabette.app.ts   identité du site (nom, sous-titre, couleur, liens)
  shell/              base commune @alphabette/shell (générée, à ne pas recoder)
```

## La base commune

Le contenu de l'application se place à l'intérieur de `<AppShell>` :

```tsx
<AppShell app={APP}>…contenu…</AppShell>
```

L'identité (nom, sous-titre, couleur, compteur, liens) se règle **uniquement**
dans `src/alphabette.app.ts`. Ne pas recoder les barres : elles viennent de la base.

## La copie de la base embarquée

`new:app` copie la dernière version de la base dans `src/shell/` : l'application
est autonome, `bun install && bun run dev` fonctionne immédiatement, sans liaison
locale. Le fichier `src/shell/.shell-version` mémorise la version embarquée.

Pour actualiser la base d'une application existante, depuis le dépôt du hub :

```powershell
bun run sync:shell <chemin-de-cette-application>
```
