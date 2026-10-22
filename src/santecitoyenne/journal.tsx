/**
 * Santé Citoyenne — « Journal » : le carnet de suivi du bien-être.
 *
 * Objectif : noter comment va la journée en moins de quinze secondes, sans
 * compte, sans jugement, avec des indicateurs d'impact qui encouragent sans
 * jamais inquiéter. Tout est sauvegardé sur l'appareil (LocalStorage).
 */
import { useMemo, useState } from 'react';
import { Carte, EtatVide, Note, Pastille, useVoix } from './commun';
import { ICoche, ICorbeille } from './icons';
import {
  aujourdhuiISO, dateLongue, heureISO, jourNum, ilYA, nouvelId, usePersiste, CLES,
} from './stockage';
import type { Entree, Humeur } from './types';

/* Le carnet propose 5 crans d'énergie, chacun avec un mot tout simple. */
const NIVEAUX_ENERGIE = [
  { valeur: 1, mot: 'Très basse' },
  { valeur: 2, mot: 'Basse' },
  { valeur: 3, mot: 'Correcte' },
  { valeur: 4, mot: 'Bonne' },
  { valeur: 5, mot: 'Très bonne' },
] as const;

const LABELS_HUMEUR: Record<Humeur, string> = {
  serein: 'Serein',
  moyen: 'Mitigé',
  lourd: 'Un jour lourd',
};

const BALISES = [
  'Sommeil', 'Douleur', 'Marche', 'Repas',
  'Courses', 'RD médical', 'Visite', 'Entraide',
] as const;

type Filtre = 'tout' | 'semaine' | 'mot' | 'balise';

/* ------------------------------------------------------------------ */
/* Aides                                                               */
/* ------------------------------------------------------------------ */

function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

/** Jour « YYYY-MM-DD » correspondant à « n jours avant jourNum » (stable). */
function jourDepuis(nouveau: number): string {
  const ms = Date.UTC(1970, 0, 1, 12) + nouveau * 86_400_000;
  const d = new Date(ms);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const j = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${j}`;
}

/** Nombre de jours consécutifs notés (aujourd'hui, sinon à partir d'hier). */
function serieConsecutive(entrees: Entree[]): number {
  const jours = new Set(entrees.map((e) => e.date));
  const auj = jourNum(aujourdhuiISO());
  let curseur = jours.has(aujourdhuiISO()) ? aujourdhuiISO() : jourDepuis(auj - 1);
  let nombre = 0;
  while (jours.has(curseur)) {
    nombre += 1;
    curseur = jourDepuis(jourNum(curseur) - 1);
  }
  return nombre;
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function Journal() {
  const [entrees, setEntrees] = usePersiste<Entree[]>(CLES.journal, []);
  const voix = useVoix();

  // Le formulaire est pré-rempli si la journée est déjà notée : on l'ajuste,
  // on ne la ré-écrit jamais à l'insu de l'utilisateur.
  const [dateForm, setDateForm] = useState<string>(aujourdhuiISO());
  const [energie, setEnergie] = useState<number>(0);
  const [humeur, setHumeur] = useState<Humeur | null>(null);
  const [balisesChoisies, setBalisesChoisies] = useState<string[]>([]);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState('');

  const entreeDuJour = useMemo(
    () => entrees.find((e) => e.date === dateForm) ?? null,
    [entrees, dateForm],
  );

  const dejaCoche = (b: string) => balisesChoisies.includes(b);

  function ouvrirJour(iso: string) {
    setDateForm(iso);
    const existante = entrees.find((e) => e.date === iso);
    setEnergie(existante ? existante.energie : 0);
    setHumeur(existante ? existante.humeur : null);
    setBalisesChoisies(existante ? [...existante.balises] : []);
    setTexte(existante?.texte ?? '');
    setErreur('');
  }

  function changerBalise(b: string) {
    setBalisesChoisies((avant) => (avant.includes(b) ? avant.filter((x) => x !== b) : [...avant, b]));
  }

  function enregistrer() {
    if (energie === 0) {
      setErreur('Choisissez d’abord votre énergie du jour — même « très basse ».');
      return;
    }
    setErreur('');
    const nouvelle: Entree = {
      id: entreeDuJour?.id ?? nouvelId(),
      date: dateForm,
      heure: entreeDuJour?.heure ?? heureISO(),
      energie,
      humeur: humeur ?? 'moyen',
      balises: balisesChoisies,
      texte: texte.trim() ? texte.trim() : undefined,
    };
    setEntrees((avant) => {
      const autre = avant.filter((e) => e.id !== nouvelle.id);
      return [...autre, nouvelle].sort((a, b) => b.date.localeCompare(a.date));
    });
    if (entreeDuJour) {
      voix.dire('Journée mise à jour. Merci de regarder après vous.', 'bravo');
    } else {
      voix.dire('Noté. Chaque petit pas compte, vraiment.', 'bravo');
    }
    setDateForm(aujourdhuiISO());
    setEnergie(0);
    setHumeur(null);
    setBalisesChoisies([]);
    setTexte('');
  }

  function retirer(id: string) {
    setEntrees((avant) => avant.filter((e) => e.id !== id));
    voix.dire('Entrée retirée. Le carnet suit votre rythme, sans retenue.');
  }

  /* --- Filtres temps réel ------------------------------------------ */
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [baliseFiltre, setBaliseFiltre] = useState<string>('');

  const affichees = useMemo(() => {
    let liste = [...entrees].sort((a, b) => b.date.localeCompare(a.date));
    if (filtre === 'semaine') {
      const depuis = jourNum(ilYA(6));
      liste = liste.filter((e) => jourNum(e.date) >= depuis);
    }
    if (filtre === 'mot') liste = liste.filter((e) => Boolean(e.texte));
    if (filtre === 'balise' && baliseFiltre) liste = liste.filter((e) => e.balises.includes(baliseFiltre));
    return liste;
  }, [entrees, filtre, baliseFiltre]);

  /* --- Indicateurs d'impact ----------------------------------------- */
  const indicateurs = useMemo(() => {
    const debut7 = jourNum(ilYA(7));
    const debut14 = jourNum(ilYA(14));
    const semaine = entrees.filter((e) => jourNum(e.date) >= debut7);
    const avant = entrees.filter((e) => jourNum(e.date) >= debut14 && jourNum(e.date) < debut7);
    const moyenneSemaine = moyenne(semaine.map((e) => e.energie));
    const moyenneAvant = moyenne(avant.map((e) => e.energie));
    const repartition: Record<Humeur, number> = { serein: 0, moyen: 0, lourd: 0 };
    for (const e of semaine) repartition[e.humeur] += 1;
    return {
      serie: serieConsecutive(entrees),
      nombre: semaine.length,
      moyenneSemaine,
      moyenneAvant,
      repartition,
    };
  }, [entrees]);

  return (
    <div className="sc-bloc">
      {/* Formulaire : premier et gros — c'est le geste le plus fréquent. */}
      <Carte
        titre={entreeDuJour ? `Ajuster ${dateLongue(dateForm)}` : 'Comment va votre journée ?'}
        sousTitre="Quinze secondes suffisent. Aucune réponse n'est jamais « fausse »."
      >
        <form
          className="sc-forme"
          onSubmit={(e) => {
            e.preventDefault();
            enregistrer();
          }}
        >
          <div className="sc-champ">
            <span className="sc-etiquette-pour">
              Votre énergie du jour <em className="sc-etiquette-indice">(une boussole, pas une note)</em>
            </span>
            <div className="sc-choix" role="radiogroup" aria-label="Énergie du jour">
              {NIVEAUX_ENERGIE.map((n) => (
                <label
                  key={n.valeur}
                  className={`sc-choix__item ${energie === n.valeur ? 'sc-choix__item--actif' : ''}`}
                >
                  <input
                    type="radio"
                    name="sc-energie"
                    value={n.valeur}
                    checked={energie === n.valeur}
                    onChange={() => { setEnergie(n.valeur); setErreur(''); }}
                  />
                  <span className="sc-choix__mot">{n.valeur}</span>
                  <span className="sc-choix__sous">{n.mot}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sc-champ">
            <span className="sc-etiquette-pour">Et le cœur ?</span>
            <div className="sc-choix" role="radiogroup" aria-label="Humeur du jour">
              {(Object.keys(LABELS_HUMEUR) as Humeur[]).map((h) => (
                <label
                  key={h}
                  className={`sc-choix__item sc-choix__item--large ${humeur === h ? 'sc-choix__item--actif' : ''}`}
                >
                  <input
                    type="radio"
                    name="sc-humeur"
                    value={h}
                    checked={humeur === h}
                    onChange={() => setHumeur(h)}
                  />
                  <span className="sc-choix__mot">{LABELS_HUMEUR[h]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="sc-champ">
            <span className="sc-etiquette-pour">
              Ce qui a marqué la journée <em className="sc-etiquette-indice">(facultatif)</em>
            </span>
            <div className="sc-choix sc-choix--puces" role="group" aria-label="Balises de la journée">
              {BALISES.map((b) => (
                <label key={b} className={`sc-puce ${dejaCoche(b) ? 'sc-puce--on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={dejaCoche(b)}
                    onChange={() => changerBalise(b)}
                  />
                  {b}
                </label>
              ))}
            </div>
          </div>

          <div className="sc-champ">
            <label className="sc-etiquette-pour" htmlFor="sc-mot">
              Un mot sur la journée <em className="sc-etiquette-indice">(facultatif, 300 caractères)</em>
            </label>
            <textarea
              id="sc-mot"
              className="sc-saisie"
              rows={3}
              maxLength={300}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Ce que vous avez tenu, ce qui vous a soulagé…"
            />
          </div>

          <div className="sc-champ sc-champ--date">
            <label className="sc-etiquette-pour" htmlFor="sc-date">Quelle journée ?</label>
            <input
              id="sc-date"
              type="date"
              className="sc-saisie sc-saisie--date"
              value={dateForm}
              onChange={(e) => {
                if (e.target.value) ouvrirJour(e.target.value);
              }}
              max={aujourdhuiISO()}
            />
          </div>

          {erreur && <p className="sc-alerte" role="alert">{erreur}</p>}

          <div className="sc-actions">
            <button type="submit" className="sc-btn sc-btn--principal sc-btn--grand">
              <ICoche taille={20} />
              {entreeDuJour ? 'Mettre à jour ma journée' : 'Enregistrer ma journée'}
            </button>
          </div>
          <Note>
            Votre carnet reste sur cet appareil — jamais envoyé, jamais consulté ailleurs.
          </Note>
        </form>
      </Carte>

      {/* Indicateurs d'impact : généreux, jamais intimidants. */}
      <Carte
        titre="Votre impact cette semaine"
        sousTitre="Un miroir tranquille — aucun verdict, aucune comparaison avec les autres."
      >
        <div className="sc-faits">
          <div className="sc-fait">
            <span className="sc-fait__nombre">{indicateurs.serie}</span>
            <span className="sc-fait__libelle">
              jour{indicateurs.serie > 1 ? 's' : ''} d'affilée
              <em>chaque jour noté nourrit la série</em>
            </span>
          </div>
          <div className="sc-fait">
            <span className="sc-fait__nombre">{indicateurs.nombre}</span>
            <span className="sc-fait__libelle">
              entrée{indicateurs.nombre > 1 ? 's' : ''} en 7 jours
              <em>la régularité vaut mieux que la perfection</em>
            </span>
          </div>
          <div className="sc-fait">
            <span className="sc-fait__nombre">
              {indicateurs.moyenneSemaine === null ? '—' : `≈ ${indicateurs.moyenneSemaine.toFixed(1)}`}
            </span>
            <span className="sc-fait__libelle">
              énergie moyenne sur 5
              <em>
                {indicateurs.moyenneAvant === null
                  ? 'la base se construit, patience'
                  : `semaine passée : ${indicateurs.moyenneAvant.toFixed(1)}/5 — tout rythme est un rythme`}
              </em>
            </span>
          </div>
        </div>

        {indicateurs.nombre > 0 && (
          <div className="sc-repartition">
            {(['serein', 'moyen', 'lourd'] as const).map((h) => {
              const part = indicateurs.repartition[h] / indicateurs.nombre;
              return (
                <div key={h} className="sc-repartition__ligne">
                  <span className="sc-repartition__nom">{LABELS_HUMEUR[h]}</span>
                  <span className="sc-repartition__barre" aria-hidden="true">
                    <span className="sc-repartition__remplie" style={{ width: `${Math.round(part * 100)}%` }} />
                  </span>
                  <span className="sc-repartition__valeur">{indicateurs.repartition[h]}</span>
                </div>
              );
            })}
          </div>
        )}
      </Carte>

      {/* Historique + filtres temps réel */}
      <Carte titre="Votre carnet" sousTitre="Retrouvez, filtrez, ajustez — le carnet est vivant.">
        <div className="sc-filtres" role="group" aria-label="Filtrer le carnet">
          {([['tout', 'Tout'], ['semaine', '7 derniers jours'], ['mot', 'Avec un mot'], ['balise', 'Par balise']] as const).map(
            ([cle, label]) => (
              <label key={cle} className={`sc-puce ${filtre === cle ? 'sc-puce--on' : ''}`}>
                <input
                  type="radio"
                  name="sc-filtre"
                  checked={filtre === cle}
                  onChange={() => setFiltre(cle)}
                />
                {label}
              </label>
            ),
          )}
          {filtre === 'balise' && (
            <select
              className="sc-saisie sc-saisie--select"
              aria-label="Balise à filtrer"
              value={baliseFiltre}
              onChange={(e) => setBaliseFiltre(e.target.value)}
            >
              <option value="">Choisir une balise…</option>
              {BALISES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>

        {affichees.length === 0 ? (
          entrees.length === 0 ? (
            <EtatVide
              illustration="journal"
              titre="Votre carnet est prêt à accueillir"
              texte="La première entrée est souvent la plus hésitante. Écrivez juste votre énergie : le reste viendra tout seul."
            />
          ) : (
            <EtatVide
              illustration="journal"
              titre="Rien dans ce filtre"
              texte="Aucune entrée ne correspond pour l'instant. Essayez « Tout » pour revoir le carnet complet."
            />
          )
        ) : (
          <ul className="sc-liste-entrees">
            {affichees.map((e) => (
              <li key={e.id} className="sc-entree">
                <div className="sc-entree__tete">
                  <span className="sc-entree__date">{dateLongue(e.date)}</span>
                  <span className="sc-entree__heure">{e.heure}</span>
                </div>
                <div
                  className="sc-entree__mesures"
                  aria-label={`Énergie ${e.energie} sur 5, humeur : ${LABELS_HUMEUR[e.humeur]}`}
                >
                  <span className="sc-pips" aria-hidden="true">
                    {NIVEAUX_ENERGIE.map((n) => (
                      <span key={n.valeur} className={`sc-pip ${e.energie >= n.valeur ? 'sc-pip--on' : ''}`} />
                    ))}
                  </span>
                  <span className="sc-entree__humeur">{LABELS_HUMEUR[e.humeur]}</span>
                </div>
                {e.balises.length > 0 && (
                  <div className="sc-entree__balises">
                    {e.balises.map((b) => (
                      <Pastille key={b}>{b}</Pastille>
                    ))}
                  </div>
                )}
                {e.texte && <p className="sc-entree__texte">« {e.texte} »</p>}
                <div className="sc-entree__actions">
                  <button type="button" className="sc-btn sc-btn--txt" onClick={() => ouvrirJour(e.date)}>
                    Ajuster
                  </button>
                  <button
                    type="button"
                    className="sc-btn sc-btn--txt sc-btn--attention"
                    onClick={() => retirer(e.id)}
                  >
                    <ICorbeille taille={16} />
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Note>
        Santé Citoyenne accompagne le quotidien et la prévention douce. Ce carnet
        ne remplace ni un médecin, ni une consultation — en cas d'urgence,
        consultez la pochette d'urgence, en bas de la barre.
      </Note>
    </div>
  );
}
