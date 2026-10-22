/**
 * Santé Citoyenne — pictogrammes SVG maison.
 *
 * Le dessin suit le style de la base commune : trait 2, extrémités rondes,
 * hauteur 1em, couleur héritée (currentColor). Aucune librairie externe :
 * l'application reste légère et fonctionne 100 % hors-ligne.
 */
import type { CSSProperties } from 'react';

interface PropsIcone {
  taille?: number;
  style?: CSSProperties;
}

function Svg({
  taille = 24,
  children,
  titre,
}: PropsIcone & { children: React.ReactNode; titre: string }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none' }}
    >
      <title>{titre}</title>
      {children}
    </svg>
  );
}

/** Calendrier avec un cœur — le carnet de suivi. */
export function IJournal(props: PropsIcone) {
  return (
    <Svg {...props} titre="Journal de suivi">
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <path d="M12 17.2s-3.1-1.9-3.1-4a1.8 1.8 0 0 1 3.1-1.3A1.8 1.8 0 0 1 15.1 13.2c0 2.1-3.1 4-3.1 4Z" />
    </Svg>
  );
}

/** Vagues de souffle — la respiration. */
export function ISouffle(props: PropsIcone) {
  return (
    <Svg {...props} titre="Respirer">
      <path d="M3 8.5c0-2.2 1.8-4 4-4s4 1.6 4 3.6-1.5 3.4-3.6 3.4H3" />
      <path d="M3 15.5h13.5a3.5 3.5 0 1 1-3.4 4.4" />
      <path d="M13.5 11.5H21" />
    </Svg>
  );
}

/** Épingle de carte — l'entourage de proximité. */
export function ICarte(props: PropsIcone) {
  return (
    <Svg {...props} titre="Carte de proximité">
      <path d="M20 10.4c0 5.2-6.2 10.1-8 11.5-1.8-1.4-8-6.3-8-11.5a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10.3" r="2.8" />
    </Svg>
  );
}

/** Trousse à croix — la pochette d'urgence. */
export function IPochette(props: PropsIcone) {
  return (
    <Svg {...props} titre="Pochette d'urgence">
      <rect x="3" y="7.5" width="18" height="13" rx="3" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M12 11v6M9 14h6" />
    </Svg>
  );
}

/** Petit cœur plein — la marque de l'app. */
export function ICoeur({ taille = 16, style }: PropsIcone) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" style={{ flex: 'none', ...style }}>
      <path d="M12 21s-7.5-4.7-9.3-9A5.4 5.4 0 0 1 12 7.2 5.4 5.4 0 0 1 21.3 12c-1.8 4.3-9.3 9-9.3 9Z" />
    </svg>
  );
}

export function IPlus(props: PropsIcone) {
  return (
    <Svg {...props} titre="Ajouter">
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ICroix(props: PropsIcone) {
  return (
    <Svg {...props} titre="Fermer ou retirer">
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function ICoche(props: PropsIcone) {
  return (
    <Svg {...props} titre="Validé">
      <path d="M4.5 12.8 9.6 18 19.5 6.8" />
    </Svg>
  );
}

export function ICorbeille(props: PropsIcone) {
  return (
    <Svg {...props} titre="Supprimer">
      <path d="M4 7h16M9.5 7V4.8A1.8 1.8 0 0 1 11.3 3h1.4a1.8 1.8 0 0 1 1.8 1.8V7" />
      <path d="M6.3 7l.8 12.2A2 2 0 0 0 9.1 21h5.8a2 2 0 0 0 2-1.8L17.7 7" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

export function IImprimer(props: PropsIcone) {
  return (
    <Svg {...props} titre="Imprimer">
      <path d="M7 8V3.5h10V8" />
      <rect x="4" y="8" width="16" height="8.5" rx="2" />
      <path d="M7 13.5h10V21H7Z" />
    </Svg>
  );
}

export function IExporter(props: PropsIcone) {
  return (
    <Svg {...props} titre="Exporter vers un fichier">
      <path d="M12 3.5v10M8.3 10 12 13.7 15.7 10" />
      <path d="M4.5 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
    </Svg>
  );
}

export function IImporter(props: PropsIcone) {
  return (
    <Svg {...props} titre="Importer depuis un fichier">
      <path d="M12 13.5v-10M8.3 7 12 3.4 15.7 7" />
      <path d="M4.5 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
    </Svg>
  );
}

/** Éclair — les ressources qui répondent vite (< 15 min). */
export function IEclair({ taille = 14, style }: PropsIcone) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" style={{ flex: 'none', ...style }}>
      <path d="M13.2 2 4.5 13.6h5.3L9.1 22l8.8-11.8h-5.4L13.2 2Z" />
    </svg>
  );
}

/** Information douce — la note « ce n'est pas un avis médical ». */
export function IInfo(props: PropsIcone) {
  return (
    <Svg {...props} titre="Information">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 10.8v5.4" />
      <circle cx="12" cy="7.6" r="0.55" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Flèche d'itinéraire — le lien « ouvrir l'itinéraire ». */
export function IBoussole(props: PropsIcone) {
  return (
    <Svg {...props} titre="Itinéraire">
      <circle cx="12" cy="12" r="9.2" />
      <path d="m15.5 8.5-2.1 5-5 2.1 2.1-5 5-2.1Z" />
    </Svg>
  );
}
