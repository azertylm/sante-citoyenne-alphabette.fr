/**
 * Santé Citoyenne — stockage local.
 *
 * Règle de vie privée : TOUTES les données vivent dans le localStorage de
 * l'appareil. Aucun envoi réseau, aucun traçeur, aucune création de compte.
 * Le module fournit :
 *   · lire / ecrire  — avec repli silencieux (navigation privée, quota…) ;
 *   · usePersiste    — hook React « état sauvegardé tout seul » ;
 *   · exporter / importer — emporter ses données (JSON) ou les remettre ;
 *   · effacerTout    — supprimer définitivement (RGPD).
 *
 * Chaque bloc de données a sa clé : on peut supprimer une partie sans_sotir le
 * reste.
 */
import { useEffect, useState } from 'react';

/** Préfixe commun : on retrouve tout en un seul endroit. */
const PREFIXE = 'santeCitoyenne.';

/** Les blocs de données, du plus intime au plus pratique. */
export const CLES = {
  journal: 'journal.v1',
  souffle: 'souffle.v1',
  entourage: 'entourage.v1',
  pochette: 'pochette.v1',
  /** Dernier onglet visité (circadien : on reprend là où on était). */
  onglet: 'onglet.v1',
} as const;

/** Liste complète (export / « tout supprimer »). */
export const TOUTES_CLES: string[] = Object.values(CLES);

/** Lit une clé, avec repli si le stockage est absent ou abîmé. */
export function lire<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    if (brut === null) return defaut;
    return JSON.parse(brut) as T;
  } catch {
    return defaut;
  }
}

/** Écrit une clé ; échoue sans faire tomber l'application (mode privé…). */
export function ecrire<T>(cle: string, valeur: T) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible : l'app continue, simplement moins aidante. */
  }
}

/** Supprime une clé. */
export function supprimer(cle: string) {
  try {
    localStorage.removeItem(PREFIXE + cle);
  } catch {
    /* idem */
  }
}

/** État React « persisté » : chaque changement est sauvegardé tout seul. */
export function usePersiste<T>(cle: string, defaut: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [valeur, setValeur] = useState<T>(() => lire(cle, defaut));
  useEffect(() => {
    ecrire(cle, valeur);
  }, [cle, valeur]);
  return [valeur, setValeur];
}

/* ------------------------------------------------------------------ */
/* Dates — toujours en temps local, jamais en UTC flottant             */
/* ------------------------------------------------------------------ */

/** Aujourd'hui en « YYYY-MM-DD » local. */
export function aujourdhuiISO(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const j = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${j}`;
}

/** Heure locale « HH:mm ». */
export function heureISO(date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** « YYYY-MM-DD » → nombre de jours depuis l'époque (comparaisons fiables). */
export function jourNum(iso: string): number {
  const [y, m, j] = iso.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, (m ?? 1) - 1, j ?? 1) / 86_400_000);
}

/** Il y a n jours, en « YYYY-MM-DD ». */
export function ilYA(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return aujourdhuiISO(d);
}

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long',
});

/** « 2026-10-22 » → « jeudi 22 octobre ». */
export function dateLongue(iso: string): string {
  try {
    const [y, m, j] = iso.slice(0, 10).split('-').map(Number);
    return FORMAT_DATE.format(new Date(y, (m ?? 1) - 1, j ?? 1));
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/* Export / import — emporter ses données (RGPD)                       */
/* ------------------------------------------------------------------ */

import type { Sauvegarde } from './types';

/** Construit un fichier de sauvegarde complet, lisible, ré-importable. */
export function construireSauvegarde(): Sauvegarde {
  const donnees: Record<string, unknown> = {};
  for (const cle of TOUTES_CLES) {
    donnees[cle] = lire(cle, null);
  }
  return { app: 'sante-citoyenne', format: 1, date: aujourdhuiISO(), donnees };
}

/** Propose le téléchargement d'une sauvegarde. */
export function telechargerSauvegarde(sauvegarde: Sauvegarde) {
  const blob = new Blob([JSON.stringify(sauvegarde, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sante-citoyenne-${sauvegarde.date}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Vérifie puis applique un fichier de sauvegarde. Renvoie un bilan humain. */
export function appliquerSauvegarde(texte: string): { ok: boolean; message: string } {
  let parse: unknown;
  try {
    parse = JSON.parse(texte);
  } catch {
    return { ok: false, message: 'Ce fichier n’est pas une sauvegarde Santé Citoyenne lisible.' };
  }
  const candidat = parse as Partial<Sauvegarde>;
  if (!candidat || candidat.app !== 'sante-citoyenne' || typeof candidat.donnees !== 'object' || candidat.donnees === null) {
    return { ok: false, message: 'Ce fichier n’est pas une sauvegarde Santé Citoyenne. Aucune donnée n’a été changée.' };
  }
  let remises = 0;
  const donnees = candidat.donnees as Record<string, unknown>;
  for (const cle of TOUTES_CLES) {
    if (donnees[cle] !== undefined) {
      ecrire(cle, donnees[cle]);
      remises += 1;
    }
  }
  if (remises === 0) {
    return { ok: false, message: 'La sauvegarde est vide (aucun bloc reconnu). Rien n’a été changé.' };
  }
  return { ok: true, message: `Données remises en place (${remises} bloc${remises > 1 ? 's' : ''}). La page se rafraîchit.` };
}

/** Supprime tous les blocs de données de l'appareil — réel et définitif. */
export function effacerTout() {
  for (const cle of TOUTES_CLES) supprimer(cle);
}

/** Identifiant court, stable, sans aucune donnée personnelle. */
export function nouvelId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
