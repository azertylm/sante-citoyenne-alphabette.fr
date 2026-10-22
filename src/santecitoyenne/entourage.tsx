/**
 * Santé Citoyenne — « Entourage » : la carte de proximité.
 *
 * Une cartographie interactive SANS carte extérieure (donc 100 % hors-ligne
 * et sans traçeur) : chaque ressource est placée autour de « chez moi » par
 * une distance et une direction rapportées par l'utilisateur. C'est honnête :
 * on dessine son quartier, on ne le survole pas.
 *
 * Géolocalisation : toujours proposée, jamais pressée. Si l'utilisateur
 * accepte, « chez moi » est mémorisé localement (3 décimales, ≈ 110 m de
 * précision). Cela sert uniquement à proposer un itinéraire OpenStreetMap
 * pour chaque ressource, position calculée depuis distance + direction.
 */
import { useMemo, useState } from 'react';
import { Carte, EtatVide, Note, useVoix } from './commun';
import { IBoussole, ICoeur, ICroix, IEclair, IPlus } from './icons';
import { aujourdhuiISO, nouvelId, usePersiste, CLES } from './stockage';
import type { Entourage as EntourageData, Maison, PointCardinal, Ressource, TypeRessource } from './types';

/* ------------------------------------------------------------------ */
/* Types de ressources — quatre familles, quatre mots simples          */
/* ------------------------------------------------------------------ */

const TYPES: Record<TypeRessource, { mot: string; description: string; lettre: string }> = {
  sante: { mot: 'Santé', description: 'médecin, pharmacien, kiné…', lettre: '+' },
  entraide: { mot: 'Entraide', description: 'voisin, association…', lettre: '♥' },
  ecole: { mot: 'École', description: 'crèche, école, atelier…', lettre: '★' },
  transit: { mot: 'Transports', description: 'arrêt, gare, covoiturage…', lettre: '→' },
};

const DIRECTIONS: { cle: PointCardinal; mot: string }[] = [
  { cle: 'N', mot: 'Nord' },
  { cle: 'NE', mot: 'Nord-est' },
  { cle: 'E', mot: 'Est' },
  { cle: 'SE', mot: 'Sud-est' },
  { cle: 'S', mot: 'Sud' },
  { cle: 'SO', mot: 'Sud-ouest' },
  { cle: 'O', mot: 'Ouest' },
  { cle: 'NO', mot: 'Nord-ouest' },
];

const KMS = [0.5, 1, 2, 5, 10] as const;

/** Direction → degrés (0 = Nord, sens horaire). */
function degres(direction: PointCardinal): number {
  const index = DIRECTIONS.findIndex((d) => d.cle === direction);
  return index >= 0 ? index * 45 : 0;
}

/** Échelle « agréable » : 1 / 2 / 5 / 10 / 20 / 50 km. */
function echelle(maxKm: number): number {
  for (const pas of [1, 2, 5, 10, 20, 50]) if (maxKm <= pas) return pas;
  return 50;
}

/** Position « chez moi » avec précision honnête (stockée localement). */
async function positionActuelle(): Promise<{ lat: number; lon: number }> {
  return new Promise((resoudre, rejeter) => {
    if (!('geolocation' in navigator)) {
      rejeter(new Error('indisponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // 3 décimales ≈ 110 m : assez pour un itinéraire, pas assez pour décrire une vie.
        resoudre({
          lat: Math.round(position.coords.latitude * 1e3) / 1e3,
          lon: Math.round(position.coords.longitude * 1e3) / 1e3,
        });
      },
      () => rejeter(new Error('refus')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 3_600_000 },
    );
  });
}

/** Position approximative d'une ressource : chez moi + km + direction. */
function approx(maison: Maison | undefined, r: Ressource): { lat: number; lon: number } | null {
  if (!maison || maison.lat === undefined || maison.lon === undefined) return null;
  const theta = (degres(r.direction) * Math.PI) / 180;
  const dLat = (r.km * Math.cos(theta)) / 111.32;
  const dLon = (r.km * Math.sin(theta)) / (111.32 * Math.max(0.2, Math.cos((maison.lat * Math.PI) / 180)));
  return { lat: Math.round((maison.lat + dLat) * 1e3) / 1e3, lon: Math.round((maison.lon + dLon) * 1e3) / 1e3 };
}

function lienOSM(maison: Maison | undefined, r: Ressource): string | null {
  const p = approx(maison, r);
  if (!p) return null;
  return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=15/${p.lat}/${p.lon}`;
}

/* Repères posés au premier lancement — visibles, amovibles, jamais cachés. */
const EXEMPLES: Ressource[] = [
  { id: 'ex-1', nom: 'Pharmacie du quartier', type: 'sante', km: 0.8, direction: 'NE', exemple: true },
  { id: 'ex-2', nom: 'Jeanne, la voisine d’en face', type: 'entraide', km: 0.3, direction: 'O', rapide: true, exemple: true },
  { id: 'ex-3', nom: 'Association d’entraide', type: 'entraide', km: 4, direction: 'S', exemple: true },
  { id: 'ex-4', nom: 'Arrêt de bus de la place', type: 'transit', km: 0.6, direction: 'E', exemple: true },
];

export function EntourageSection() {
  const [carte, setCarte] = usePersiste<EntourageData>(CLES.entourage, { ressources: EXEMPLES });
  const voix = useVoix();

  const maison = carte.maison;
  const [cible, setCible] = useState<string | null>(null); // id de la ressource ciblée

  /* --- Filtres temps réel ------------------------------------------ */
  const [typesRecherches, setTypesRecherches] = useState<Set<TypeRessource>>(new Set());
  const [rapideSeul, setRapideSeul] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [vue, setVue] = useState<'roue' | 'liste'>('roue');

  const resultats = useMemo(() => {
    let liste = [...carte.ressources];
    if (typesRecherches.size > 0) liste = liste.filter((r) => typesRecherches.has(r.type));
    if (rapideSeul) liste = liste.filter((r) => Boolean(r.rapide));
    if (recherche.trim()) {
      const motif = recherche.trim().toLowerCase();
      liste = liste.filter((r) => r.nom.toLowerCase().includes(motif));
    }
    return liste.sort((a, b) => a.km - b.km);
  }, [carte, typesRecherches, rapideSeul, recherche]);

  const fiche = cible ? carte.ressources.find((r) => r.id === cible) : null;

  async function poserMaison() {
    try {
      const { lat, lon } = await positionActuelle();
      setCarte((av) => ({ ...av, maison: { lat, lon, maj: aujourdhuiISO() } }));
      voix.dire('Chez moi posé. La position (arrondie à 110 m) reste sur cet appareil.', 'bravo');
    } catch {
      voix.dire('Pas de souci : la roue fonctionne sans position. Elle est centrée sur vos habitudes.');
    }
  }

  return (
    <div className="sc-bloc">
      <Carte
        titre="Votre entourage, sur une roue"
        sousTitre="Les personnes et lieux qui font tenir vos journées — dessinés par vous."
      >
        {/* Chez moi */}
        <div className="sc-bandeau-maison">
          <div className="sc-bandeau-maison__texte">
            <span className="sc-bandeau-maison__label">Chez moi</span>
            {maison ? (
              <span className="sc-bandeau-maison__valeur">
                {maison.note?.trim() ? maison.note : `${maison.lat}, ${maison.lon}`}
                <em>position courte, enregistrée ici seulement</em>
              </span>
            ) : (
              <span className="sc-bandeau-maison__valeur">
                Pas encore posé
                <em>facultatif — la roue marche sans</em>
              </span>
            )}
          </div>
          <div className="sc-actions">
            <button type="button" className="sc-btn sc-btn--neutral" onClick={poserMaison}>
              {maison ? 'Mettre à jour' : 'Poser « chez moi »'}
            </button>
            {maison && (
              <button
                type="button"
                className="sc-btn sc-btn--txt sc-btn--attention"
                onClick={() => {
                  setCarte((av) => ({ ...av, maison: undefined }));
                  voix.dire('Position « chez moi » retirée. La roue continue, avec ses distances et directions.');
                }}
              >
                Retirer
              </button>
            )}
          </div>
        </div>

        {/* Formulaire : ajouter une ressource */}
        <FormRessource
          onValider={(r) => {
            setCarte((av) => ({ ...av, ressources: [...av.ressources, r] }));
            voix.dire(`${r.nom} est sur la roue. Bien entouré·e, on respire mieux.`, 'bravo');
          }}
        />

        {/* Filtres temps réel */}
        <div className="sc-filtres" role="group" aria-label="Filtrer l'entourage">
          {(Object.keys(TYPES) as TypeRessource[]).map((t) => {
            const actif = typesRecherches.has(t);
            return (
              <label key={t} className={`sc-puce ${actif ? 'sc-puce--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={actif}
                  onChange={() => {
                    setTypesRecherches((av) => {
                      const suivant = new Set(av);
                      if (actif) suivant.delete(t); else suivant.add(t);
                      return suivant;
                    });
                  }}
                />
                {TYPES[t].mot}
              </label>
            );
          })}
          <label className={`sc-puce ${rapideSeul ? 'sc-puce--on' : ''}`}>
            <input type="checkbox" checked={rapideSeul} onChange={(e) => setRapideSeul(e.target.checked)} />
            Répond vite
          </label>
        </div>
        <input
          className="sc-saisie"
          type="search"
          placeholder="Chercher par nom…"
          aria-label="Chercher une ressource par son nom"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />

        {/* Choix de la vue */}
        <div className="sc-vues" role="group" aria-label="Choisir la vue de l'entourage">
          <button
            type="button"
            className={`sc-btn sc-btn--segment ${vue === 'roue' ? 'sc-btn--segment-on' : ''}`}
            aria-pressed={vue === 'roue'}
            onClick={() => setVue('roue')}
          >
            Roue
          </button>
          <button
            type="button"
            className={`sc-btn sc-btn--segment ${vue === 'liste' ? 'sc-btn--segment-on' : ''}`}
            aria-pressed={vue === 'liste'}
            onClick={() => setVue('liste')}
          >
            Liste
          </button>
        </div>

        {vue === 'roue' ? (
          <Roue ressources={resultats} echel={echelle(Math.max(1, ...resultats.map((r) => r.km)))} maison={maison} onChoisir={(id) => setCible(id)} idCible={cible} />
        ) : (
          <ListeEntourage maison={maison} ressources={resultats} />
        )}
      </Carte>

      {/* Fiche d'accent de la ressource ciblée */}
      {fiche && (
        <FicheRessource
          maison={maison}
          r={fiche}
          surFermer={() => setCible(null)}
          surRetirer={(id) => {
            setCarte((av) => ({ ...av, ressources: av.ressources.filter((q) => q.id !== id) }));
            setCible(null);
            voix.dire('Ressource retirée de l’entourage. La roue s’allège sans blâme.');
          }}
        />
      )}

      <Note>
        Toute la roue — et le repère « chez moi », si vous le posez — vit dans cet
        appareil. Votre position n'est jamais envoyée au loin.
      </Note>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulaire de ressource                                             */
/* ------------------------------------------------------------------ */

function FormRessource({ onValider }: { onValider: (r: Ressource) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [type, setType] = useState<TypeRessource>('entraide');
  const [km, setKm] = useState<number>(1);
  const [direction, setDirection] = useState<PointCardinal>('N');
  const [rapide, setRapide] = useState(false);
  const [erreur, setErreur] = useState('');

  function enregistrer() {
    const nomPropre = nom.trim();
    if (!nomPropre) {
      setErreur('Il manque un petit nom — « Voisine », « Cabinet »… c’est vous qui écrivez.');
      return;
    }
    onValider({
      id: nouvelId(),
      nom: nomPropre,
      type,
      km: Math.min(50, Math.max(0.1, km)),
      direction,
      rapide,
    });
    setNom('');
    setType('entraide');
    setKm(1);
    setDirection('N');
    setRapide(false);
    setErreur('');
    setOuvert(false);
  }

  if (!ouvert) {
    return (
      <button type="button" className="sc-btn sc-btn--principal" onClick={() => setOuvert(true)}>
        <IPlus taille={20} />
        Ajouter à mon entourage
      </button>
    );
  }

  return (
    <form
      className="sc-forme sc-forme--carte"
      onSubmit={(e) => {
        e.preventDefault();
        enregistrer();
      }}
    >
      <div className="sc-champ">
        <label className="sc-etiquette-pour" htmlFor="sc-nom-ressource">Le petit nom</label>
        <input
          id="sc-nom-ressource"
          className="sc-saisie"
          value={nom}
          onChange={(e) => { setNom(e.target.value); setErreur(''); }}
          placeholder="Voisine du 3e, Dr Martin, cabinet du marché…"
          maxLength={60}
          autoComplete="off"
        />
      </div>

      <div className="sc-champ">
        <span className="sc-etiquette-pour">Famille</span>
        <div className="sc-choix" role="radiogroup" aria-label="Famille de la ressource">
          {(Object.keys(TYPES) as TypeRessource[]).map((t) => (
            <label key={t} className={`sc-choix__item ${type === t ? 'sc-choix__item--actif' : ''}`}>
              <input
                type="radio"
                name="sc-type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
              />
              <span className="sc-choix__mot">{TYPES[t].mot}</span>
              <span className="sc-choix__sous">{TYPES[t].description}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="sc-champ">
        <span className="sc-etiquette-pour">À environ…</span>
        <div className="sc-choix" role="radiogroup" aria-label="Distance approximative, en kilomètres">
          {KMS.map((k) => (
            <label key={k} className={`sc-choix__item ${km === k ? 'sc-choix__item--actif' : ''}`}>
              <input
                type="radio"
                name="sc-km"
                value={k}
                checked={km === k}
                onChange={() => setKm(k)}
              />
              <span className="sc-choix__mot">{k.toLocaleString('fr-FR')} km</span>
            </label>
          ))}
        </div>
      </div>

      <div className="sc-champ">
        <span className="sc-etiquette-pour">Vers où, depuis chez vous ?</span>
        <div className="sc-rose" role="radiogroup" aria-label="Direction approximative">
          {DIRECTIONS.map((d) => (
            <label
              key={d.cle}
              className={`sc-rose__item ${direction === d.cle ? 'sc-rose__item--actif' : ''}`}
            >
              <input
                type="radio"
                name="sc-direction"
                value={d.cle}
                checked={direction === d.cle}
                onChange={() => setDirection(d.cle)}
                aria-label={d.mot}
              />
              <span className="sc-rose__initiale">{d.cle}</span>
            </label>
          ))}
        </div>
      </div>

      <label className={`sc-puce sc-puce--ligne ${rapide ? 'sc-puce--on' : ''}`}>
        <input type="checkbox" checked={rapide} onChange={(e) => setRapide(e.target.checked)} />
        <IEclair taille={14} />
        Peut répondre vite (moins de 15 minutes)
      </label>

      {erreur && <p className="sc-alerte" role="alert">{erreur}</p>}

      <div className="sc-actions">
        <button type="submit" className="sc-btn sc-btn--principal">
          Ajouter sur la roue
        </button>
        <button
          type="button"
          className="sc-btn sc-btn--txt"
          onClick={() => { setOuvert(false); setErreur(''); }}
        >
          Pas maintenant
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* La roue — radar SVG interactif et accessible                        */
/* ------------------------------------------------------------------ */

function Roue({
  ressources,
  echel,
  maison,
  onChoisir,
  idCible,
}: {
  ressources: Ressource[];
  echel: number;
  maison: Maison | undefined;
  onChoisir: (id: string) => void;
  idCible: string | null;
}) {
  const RAYON = 124;
  const CENTRE = 150;

  if (ressources.length === 0) {
    return (
      <EtatVide
        illustration="entourage"
        titre="Rien dans ce filtre"
        texte="Aucune ressource ne correspond. Décochez un filtre, ou ajoutez la vôtre : votre quartier est unique, au sens propre."
      />
    );
  }

  return (
    <div>
      <svg
        viewBox="0 0 300 300"
        className="sc-radar"
        role="img"
        aria-label={`Roue de proximité : ${ressources.length} ressource${ressources.length > 1 ? 's' : ''} affichée${ressources.length > 1 ? 's' : ''}, échelle ${echel} km. La liste écrite suit sous la roue.`}
      >
        {/* Anneaux d'échelle */}
        {[0.25, 0.5, 0.75, 1].map((part) => (
          <g key={part}>
            <circle cx={CENTRE} cy={CENTRE} r={RAYON * part} className="sc-radar__anneau" />
            {part === 1 && (
              <text x={CENTRE + 5} y={CENTRE - RAYON - 4} className="sc-radar__legende">
                {echel} km
              </text>
            )}
          </g>
        ))}

        {/* Lettres cardinales */}
        {DIRECTIONS.map((d) => {
          const th = (degres(d.cle) * Math.PI) / 180;
          const x = CENTRE + Math.sin(th) * (RAYON + 14);
          const y = CENTRE - Math.cos(th) * (RAYON + 14) + 4;
          return (
            <text key={d.cle} x={x} y={y} className="sc-radar__axe">
              {d.cle}
            </text>
          );
        })}

        {/* Ressources */}
        {ressources.map((r) => {
          const th = (degres(r.direction) * Math.PI) / 180;
          const distancePx = Math.min(1, r.km / echel) * RAYON;
          const x = CENTRE + Math.sin(th) * distancePx;
          const y = CENTRE - Math.cos(th) * distancePx;
          const active = r.id === idCible;
          return (
            <g
              key={r.id}
              className={`sc-radar__point ${active ? 'sc-radar__point--cible' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => onChoisir(r.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChoisir(r.id);
                }
              }}
            >
              <title>
                {`${r.nom} — ${TYPES[r.type].mot}, à ${r.km.toLocaleString('fr-FR')} km vers le ${DIRECTIONS.find((d) => d.cle === r.direction)?.mot.toLowerCase()}`}
              </title>
              <circle cx={x} cy={y} r={r.rapide ? 21 : 16} className={`sc-radar__halo sc-radar__halo--${r.type}`} />
              <circle cx={x} cy={y} r={13} className={`sc-radar__noyau sc-radar__noyau--${r.type}`} />
              <text x={x} y={y + 4.5} className="sc-radar__lettre">
                {TYPES[r.type].lettre}
              </text>
            </g>
          );
        })}

        {/* Chez moi, au centre. */}
        <g className="sc-radar__maison-txt">
          <circle cx={CENTRE} cy={CENTRE} r={15} className="sc-radar__maison-cercle" />
          <path
            d="M150 132.5c-4.8-3.4-7.4-5.9-7.4-8.9a4.3 4.3 0 0 1 7.4-3 4.3 4.3 0 0 1 7.4 3c0 3-2.6 5.5-7.4 8.9Z"
            className="sc-radar__maison-coeur"
          />
        </g>
      </svg>

      {/* Liste écrite du même contenu — lisible de partout, utile aux lecteurs d'écran. */}
      <ul className="sc-liste-radar">
        {ressources.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`sc-choix-mini ${r.id === idCible ? 'sc-choix-mini--on' : ''}`}
              onClick={() => onChoisir(r.id)}
            >
              <span className={`sc-fiche-mini__lettre`} data-type={r.type}>
                {TYPES[r.type].lettre}
              </span>
              <span className={`sc-choix-mini__texte`}>
                <strong>{r.nom}</strong>
                <small>
                  {TYPES[r.type].mot} · ≈ {r.km.toLocaleString('fr-FR')} km · {DIRECTIONS.find((d) => d.cle === r.direction)?.mot.toLowerCase()}
                  {r.rapide ? ' · répond vite' : ''}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {maison?.note?.trim() && <p className="sc-mot-info">Repère : {maison.note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Liste (vue complète, triée)                                         */
/* ------------------------------------------------------------------ */

function ListeEntourage({ maison, ressources }: { maison: Maison | undefined; ressources: Ressource[] }) {
  if (ressources.length === 0) {
    return (
      <EtatVide
        illustration="entourage"
        titre="Rien dans ce filtre"
        texte="Aucune ressource ne correspond. Décochez un filtre, ou ajoutez la vôtre — votre quartier est unique, au sens propre."
      />
    );
  }
  return (
    <ul className="sc-liste-entourage">
      {ressources.map((r) => {
        const route = lienOSM(maison, r);
        return (
          <li key={r.id} className="sc-fiche-mini">
            <div className="sc-fiche-mini__tete">
              <span className="sc-fiche-mini__lettre" data-type={r.type}>
                {TYPES[r.type].lettre}
              </span>
              <div className="sc-fiche-mini__noms">
                <strong>{r.nom}</strong>
                <span>
                  {TYPES[r.type].mot} · à ≈ {r.km.toLocaleString('fr-FR')} km vers le {DIRECTIONS.find((d) => d.cle === r.direction)?.mot.toLowerCase()}
                  {r.rapide ? ' · réponds vite' : ''}</span>
              </div>
            </div>
            {route && (
              <a className="sc-btn sc-btn--txt" href={route} target="_blank" rel="noopener noreferrer">
                <IBoussole taille={16} />
                Itinéraire approximatif
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Fiche détaillée                                                     */
/* ------------------------------------------------------------------ */

function FicheRessource({
  maison,
  r,
  surFermer,
  surRetirer,
}: {
  maison: Maison | undefined;
  r: Ressource;
  surFermer: () => void;
  surRetirer: (id: string) => void;
}) {
  const route = lienOSM(maison, r);
  return (
    <div className="sc-fiche" role="region" aria-label={`Détail de ${r.nom}`}>
      <div className="sc-fiche__tete">
        <strong className="sc-fiche__nom">
          {r.nom}
        </strong>
        <button type="button" className="sc-fermer" aria-label="Replier la fiche" onClick={surFermer}>
          <ICroix taille={18} />
        </button>
      </div>
      <p className="sc-fiche__ligne">
        {TYPES[r.type].mot} · {TYPES[r.type].description} · à ≈ {r.km.toLocaleString('fr-FR')} km
        vers le {DIRECTIONS.find((d) => d.cle === r.direction)?.mot.toLowerCase()}
        {r.rapide ? ' · répond vite' : ''}
      </p>
      {r.exemple && (
        <p className="sc-fiche__ligne sc-fiche__ligne--exemple">
          <ICoeur taille={14} />
          Ressource d'exemple — modifiez-la ou retirez-la : elle n'est là que pour montrer le chemin.
        </p>
      )}
      <div className="sc-actions">
        {route ? (
          <a className="sc-btn sc-btn--neutral" href={route} target="_blank" rel="noopener noreferrer">
            <IBoussole taille={18} />
            Ouvrir l'itinéraire (OpenStreetMap)
          </a>
        ) : (
          <span className="sc-fiche__sans-route">Posez « chez moi » pour des itinéraires d'appoint.</span>
        )}
        <button type="button" className="sc-btn sc-btn--txt sc-btn--attention" onClick={() => surRetirer(r.id)}>
          <ICroix taille={16} />
          Retirer de l'entourage
        </button>
      </div>
    </div>
  );
}
