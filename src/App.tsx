import { AppShell } from '@alphabette/shell';
import '@alphabette/shell/style.css';
import './santecitoyenne/santecitoyenne.css';
import { useEffect, useState, type ReactNode } from 'react';
import { APP } from './alphabette.app';
import { FournisseurVoix } from './santecitoyenne/commun';
import { usePersiste, CLES } from './santecitoyenne/stockage';
import { Journal } from './santecitoyenne/journal';
import { Souffle } from './santecitoyenne/souffle';
import { EntourageSection } from './santecitoyenne/entourage';
import { PochetteSection } from './santecitoyenne/pochette';
import {
  ICarte, IJournal, IPochette, ISouffle,
} from './santecitoyenne/icons';

/**
 * Santé Citoyenne — prévention douce et entraide, près de chez vous.
 *
 * La base commune (deux barres, thème jour/nuit, densité BIG, plein écran,
 * panneaux dons/compte/clés) est fournie par <AppShell> : rien n'est recodé
 * ici. L'application vit dedans sur quatre onglets, guidés depuis une barre
 * d'action posée dans le creux du pouce :
 *
 *   · Journal    — le carnet de suivi + les indicateurs d'impact ;
 *   · Respirer   — le coach anti-anxiété (4-2-6, 5-4-3-2-1) ;
 *   · Entourage  — carte de proximité dessinée par l'utilisateur ;
 *   · Pochette   — kit d'urgence imprimable + données/vie privée.
 */
type Onglet = 'journal' | 'souffle' | 'entourage' | 'pochette';

const ONGLETS: {
  cle: Onglet;
  mot: string;
  icone: ReactNode;
  libelle: string;
}[] = [
  { cle: 'journal', mot: 'Journal', icone: <IJournal taille={22} />, libelle: 'Carnet de suivi et indicateurs' },
  { cle: 'souffle', mot: 'Respirer', icone: <ISouffle taille={22} />, libelle: 'Respiration guidée et apaisement' },
  { cle: 'entourage', mot: 'Entourage', icone: <ICarte taille={22} />, libelle: 'Carte de proximité' },
  { cle: 'pochette', mot: 'Pochette', icone: <IPochette taille={22} />, libelle: 'Pochette d’urgence et données' },
];

const ONGLETS_VALIDES = ONGLETS.map((o) => o.cle);

/** Onglet demandé par l'adresse (« /#entourage ») : liens profonds PWA utiles. */
function ongletDuHash(): Onglet | null {
  if (typeof window === 'undefined') return null;
  const propose = window.location.hash.replace(/^#/, '') as Onglet;
  return ONGLETS_VALIDES.includes(propose) ? propose : null;
}

export function App() {
  // Le dernier onglet visité est repris au retour : l'app se souvient de vous.
  // L'adresse a le dernier mot (/#souffle, /#pochette…) — partageable et
  // compatible avec le bouton « retour » du navigateur.
  const [ongletMemoire, setOngletMemoire] = usePersiste<Onglet>(CLES.onglet, 'journal');
  const [onglet, setOnglet] = useState<Onglet>(() => ongletDuHash() ?? ongletMemoire);

  // L'ancre de l'adresse pilote l'onglet (précécents/avant des navigateurs).
  useEffect(() => {
    const suivre = () => {
      const propose = ongletDuHash();
      if (propose) setOnglet(propose);
    };
    window.addEventListener('hashchange', suivre);
    return () => window.removeEventListener('hashchange', suivre);
  }, []);

  const actuel: Onglet = ONGLETS_VALIDES.includes(onglet) ? onglet : 'journal';

  function allerVers(cle: Onglet) {
    // La synchronisation passe par l'ancre : une seule source de vérité.
    if (window.location.hash.replace(/^#/, '') === cle) setOnglet(cle);
    else window.location.hash = cle;
    setOngletMemoire(cle);
    document.getElementById('sc-contenu')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  return (
    <AppShell app={APP} initialTheme="jour">
      <FournisseurVoix>
        <a className="sc-sauter" href="#sc-contenu">
          Aller au contenu
        </a>
        <main id="sc-contenu" className="sc-contenu" tabIndex={-1}>
          <h1 className="sc-sr">Santé Citoyenne — prévention douce et entraide, près de chez vous</h1>

          {actuel === 'journal' && <Journal />}
          {actuel === 'souffle' && <Souffle />}
          {actuel === 'entourage' && <EntourageSection />}
          {actuel === 'pochette' && <PochetteSection />}
        </main>

        {/* Barre d'action : cibles 60 px, portée du pouce, courante marquée. */}
        <nav className="sc-nav" aria-label="Sections de l'application">
          {ONGLETS.map((o) => (
            <button
              key={o.cle}
              type="button"
              className={`sc-nav__bouton ${actuel === o.cle ? 'sc-nav__bouton--actif' : ''}`}
              aria-current={actuel === o.cle ? 'page' : undefined}
              aria-label={`${o.mot} — ${o.libelle}`}
              onClick={() => allerVers(o.cle)}
            >
              {o.icone}
              <span>{o.mot}</span>
            </button>
          ))}
        </nav>
      </FournisseurVoix>
    </AppShell>
  );
}
