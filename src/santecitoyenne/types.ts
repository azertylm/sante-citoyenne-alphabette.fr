/**
 * Santé Citoyenne — types partagés.
 *
 * Toutes les données de l'application restent sur l'appareil (LocalStorage) :
 * rien n'est envoyé sur un serveur. Les types reflètent cette approche :
 * chaque bloc a sa propre clé de stockage et son propre format sérialisable.
 */

/* ------------------------------------------------------------------ */
/* Journal de suivi                                                    */
/* ------------------------------------------------------------------ */

/** Trois endroits simples pour dire comment on va — pas de gradations anxiogènes. */
export type Humeur = 'serein' | 'moyen' | 'lourd';

/** Une entrée du carnet (une journée, si l'utilisateur a envie d'en noter). */
export interface Entree {
  /** Identifiant stable (horodatage). */
  id: string;
  /** Jour noté, au format local « YYYY-MM-DD ». */
  date: string;
  /** Heure d'enregistrement « HH:mm » (information, jamais un engagement). */
  heure: string;
  /** Énergie ressentie sur 5 crans, de 1 (très basse) à 5 (très bonne). */
  energie: number;
  /** Humeur du jour (3 endroits simples). */
  humeur: Humeur;
  /** Balises choisies (sommeil, marche, rendez-vous…). */
  balises: string[];
  /** Un mot au sujet de la journée — facultatif. */
  texte?: string;
}

/* ------------------------------------------------------------------ */
/* Respiration / souffle                                               */
/* ------------------------------------------------------------------ */

/** Une séance de respiration terminée. */
export interface SeanceSouffle {
  /** Identifiant stable. */
  id: string;
  /** Jour « YYYY-MM-DD ». */
  date: string;
  /** Heure « HH:mm ». */
  heure: string;
  /** Durée réelle en minutes. */
  minutes: number;
}

/* ------------------------------------------------------------------ */
/* Entourage : cartographie & réseau de proximité                      */
/* ------------------------------------------------------------------ */

export type PointCardinal = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';

export type TypeRessource = 'sante' | 'entraide' | 'ecole' | 'transit';

/** Une ressource ou un repère autour de « chez moi ». */
export interface Ressource {
  id: string;
  nom: string;
  type: TypeRessource;
  /** Distance à vol d'oiseau, en kilomètres (estimation honnête). */
  km: number;
  /** Direction depuis « chez moi ». */
  direction: PointCardinal;
  /** Coche « répond vite » (entraide en moins de 15 min). */
  rapide?: boolean;
  /** Vrai pour les ressources d'exemple livrées au premier lancement. */
  exemple?: boolean;
}

/** Le repère « chez moi », si l'utilisateur a accepté de le mémoriser. */
export interface Maison {
  /** Latitude approximative (3 décimales ≈ 110 m — assez pour un itinéraire). */
  lat?: number;
  /** Longitude approximative, même règle. */
  lon?: number;
  /** Un mot libre pour nommer le repère (« la maison », « chez Mamie »…). */
  note?: string;
  /** Date d'enregistrement « YYYY-MM-DD ». */
  maj?: string;
}

export interface Entourage {
  /** Repère de départ — facultatif, la carte marche sans. */
  maison?: Maison;
  /** Les ressources autour de ce repère. */
  ressources: Ressource[];
}

/* ------------------------------------------------------------------ */
/* Pochette d'urgence                                                  */
/* ------------------------------------------------------------------ */

export interface Contact {
  id: string;
  nom: string;
  role: string;
  telephone: string;
}

export interface Pochette {
  /** Personnes à appeler. */
  contacts: Contact[];
  /** Traitements ou équipements à emporter (une ligne chacun). */
  litteries: string[];
  /** Consignes libres (allergies, choses à dire au 15…). */
  consignes: string;
}

/* ------------------------------------------------------------------ */
/* Conteneur d'export / import (RGPD : emporter ses données)           */
/* ------------------------------------------------------------------ */

export interface Sauvegarde {
  app: 'sante-citoyenne';
  format: 1;
  date: string;
  donnees: Record<string, unknown>;
}
