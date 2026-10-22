import type { AlphaAppConfig } from '@alphabette/shell';

/**
 * Configuration de l'application.
 * C'est ici que l'on décrit l'identité du site : son nom, son sous-titre, sa
 * couleur, son sous-domaine et ses liens (dons, compte, clés d'API).
 */
export const APP: AlphaAppConfig = {
  key: 'sante-citoyenne',
  name: 'Santé Citoyenne',
  tagline: 'Prévention douce et entraide, près de chez vous',

  // Couleur d'identité du site : toute la base s'y adapte.
  accent: '#155e75',

  // Adresses publiques (sous-domaine + chemin sur alphabette.fr).
  subdomain: 'santecitoyenne',
  homePath: '/sante-citoyenne',

  // Liens de l'écosystème.
  donUrl: 'https://alphabette.fr/don',
  accountUrl: 'https://alphabette.fr/compte',
  apiKeysUrl: 'https://alphabette.fr/cles',

  /**
   * Application d'intérêt public (aidants familiaux, prévention, entraide) :
   * déclarée définitivement gratuite. La base n'affiche alors ni prix, ni
   * essai, ni paiement — l'écosystème finance l'application.
   */
  gratuit: true,

  // Compteur de la barre écosystème : calculé automatiquement depuis le
  // registre central (X applications en ligne / Y au total). Pour forcer des
  // valeurs précises (ex. essai en cours), décommenter :
  // counter: { unlocked: 3, total: 16, trialDaysLeft: 7 },

  apiKeyState: 'ok',
  accountState: 'ok',
};
