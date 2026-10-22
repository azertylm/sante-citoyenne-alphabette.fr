/**
 * Santé Citoyenne — composants partagés.
 *
 * Le cœur de ce fichier : les messages bienveillants. Ici, JAMAIS d'alerte
 * native (alert/confirm) : les notifications sont des toasts non bloquants,
 * posés au-dessus du contenu, annoncés poliment à la synthèse vocale
 * (aria-live="polite") et éternellement lisibles à leur rythme.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ICoeur, ICoche, IInfo } from './icons';

/* ------------------------------------------------------------------ */
/* Notifications bienveillantes                                        */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: number;
  texte: string;
  ton: 'doux' | 'bravo';
}

/** Ce que les sections utilisent pour « dire » quelque chose de gentil. */
export interface Voix {
  /** Ajoute une note bienveillante, non bloquante, qui s'efface toute seule. */
  dire: (texte: string, ton?: Toast['ton']) => void;
}

const VoixContext = createContext<Voix | null>(null);

/** Repli silencieux : une voix qui ne dit rien plutôt qu'une panne. */
const VOIX_VIDE: Voix = { dire: () => undefined };

export function useVoix(): Voix {
  return useContext(VoixContext) ?? VOIX_VIDE;
}

const DELAI_TOAST = 5200;

export function FournisseurVoix({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<Toast[]>([]);
  const compte = useRef(0);

  const dire = useCallback((texte: string, ton: Toast['ton'] = 'doux') => {
    compte.current += 1;
    const id = compte.current;
    setFile((precedente) => [...precedente.slice(-2), { id, texte, ton }]);
    window.setTimeout(() => {
      setFile((precedente) => precedente.filter((t) => t.id !== id));
    }, DELAI_TOAST);
  }, []);

  const voix = useMemo(() => ({ dire }), [dire]);

  return (
    <VoixContext.Provider value={voix}>
      {children}
      <div className="sc-toasts" role="status" aria-live="polite" aria-relevant="additions text">
        {file.map((toast) => (
          <p key={toast.id} className={`sc-toast sc-toast--${toast.ton}`}>
            {toast.ton === 'bravo' ? (
              <ICoche taille={18} />
            ) : (
              <ICoeur taille={16} />
            )}
            <span>{toast.texte}</span>
          </p>
        ))}
      </div>
    </VoixContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Petites briques de mise en page                                     */
/* ------------------------------------------------------------------ */

/** Carte douce : le fond de tout ce qui est important de voir d'un coup. */
export function Carte({
  children,
  classe = '',
  titre,
  sousTitre,
  actions,
  id,
}: {
  children: ReactNode;
  classe?: string;
  titre?: ReactNode;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`sc-carte ${classe}`.trim()}>
      {(titre !== undefined || actions !== undefined) && (
        <header className="sc-carte__tete">
          <div className="sc-carte__titres">
            {titre !== undefined && <h3 className="sc-carte__titre">{titre}</h3>}
            {sousTitre !== undefined && <p className="sc-carte__sous">{sousTitre}</p>}
          </div>
          {actions !== undefined && <div className="sc-carte__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Une pastille d'information (balise, type…) — descriptive, jamais un bouton. */
export function Pastille({ children, ton = '' }: { children: ReactNode; ton?: string }) {
  return <span className={`sc-pastille ${ton}`.trim()}>{children}</span>;
}

/** État vides illustrés : une image douce + un mot réconfortant + un chemin. */
export function EtatVide({
  illustration,
  titre,
  texte,
  action,
}: {
  illustration: 'journal' | 'entourage' | 'pochette' | 'souffle';
  titre: string;
  texte: string;
  action?: ReactNode;
}) {
  return (
    <div className="sc-vide">
      <IllustrationVide genre={illustration} />
      <p className="sc-vide__titre">{titre}</p>
      <p className="sc-vide__texte">{texte}</p>
      {action}
    </div>
  );
}

/** Petite illustration SVG des états vides (lignes douces, aucun visage). */
function IllustrationVide({ genre }: { genre: 'journal' | 'entourage' | 'pochette' | 'souffle' }) {
  return (
    <svg viewBox="0 0 120 64" className="sc-vide__deco" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {genre === 'journal' ? (
          <>
            <rect x="34" y="10" width="52" height="44" rx="8" />
            <path d="M34 24h52M46 6v8M74 6v8" opacity="0.6" />
            <path d="M60 44s-8-5-8-10.5a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6C68 39 60 44 60 44Z" />
          </>
        ) : genre === 'entourage' ? (
          <>
            <path d="M60 54c-4-3-14-12-14-21a14 14 0 0 1 28 0c0 9-10 18-14 21Z" />
            <circle cx="60" cy="32" r="5" opacity="0.6" />
            <path d="M24 14a24 24 0 0 1 24-8M96 14a24 24 0 0 0-24-8" opacity="0.45" />
          </>
        ) : genre === 'pochette' ? (
          <>
            <rect x="34" y="22" width="52" height="32" rx="8" />
            <path d="M50 22v-4a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v4" opacity="0.6" />
            <path d="M60 32v12M54 38h12" />
          </>
        ) : (
          <>
            <circle cx="60" cy="32" r="16" opacity="0.6" />
            <path d="M60 16v-6M60 54v-6M44 32h-6M82 32h-6" />
            <circle cx="60" cy="32" r="5" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Note informations : lisible, avec l'icône info douce. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="sc-note">
      <IInfo taille={16} />
      <span>{children}</span>
    </p>
  );
}

/** Grandes étiquettes d'aiguillage des formulaires. */
export function Etiquette({ children, indice }: { children: ReactNode; indice?: string }) {
  return (
    <span className="sc-etiquette-pour">
      {children}
      {indice && <em className="sc-etiquette-indice"> {indice}</em>}
    </span>
  );
}
