/**
 * Santé Citoyenne — « Respirer » : le coach anti-anxiété.
 *
 * Une respiration guidée 4-2-6 (inspirer 4 s · pause 2 s · souffler 6 s),
 * trois durées possibles, aucun chrono brandi : on peut arrêter à tout moment
 * et la séance compte quand même. L'exercice « 5-4-3-2-1 » accompagne les
 * moments de surcharge. Les consignes sont annoncées à la synthèse vocale
 * (aria-live="polite") ; par respect du réglage système, le cercle reste
 * immobile si l'utilisateur demande un mouvement réduit (CSS).
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Carte, EtatVide, Note, useVoix } from './commun';
import { aujourdhuiISO, dateLongue, heureISO, nouvelId, usePersiste, CLES } from './stockage';
import type { SeanceSouffle } from './types';

/** Une phase du cycle. 4 + 2 + 6 = 12 secondes, et on recommence serein. */
const CYCLE = [
  { cle: 'inspire', consigne: 'Inspirez par le nez — le ventre qui se gonfle', duree: 4 },
  { cle: 'pause', consigne: 'Petite pause — l’air reste là, sans effort', duree: 2 },
  { cle: 'souffle', consigne: 'Soufflez par la bouche, comme si vous éteigniez une bougie', duree: 6 },
] as const;

const DUREEUR_CYCLES = 12;

const DUREES = [
  { minutes: 1, mot: '1 minute', note: 'une pause qui décrasse' },
  { minutes: 3, mot: '3 minutes', note: 'le bon format entre deux tâches' },
  { minutes: 5, mot: '5 minutes', note: 'pour remettre les pendules au calme' },
] as const;

const MOTS_APRES = [
  'Vous venez de faire quelque chose d’utile pour vous — c’est noté.',
  'Un souffle après l’autre : le corps sait, la tête suit.',
  'Ce n’est pas une performance, c’est de la tendresse envers vous.',
  'Douze cycles… ou deux : les deux comptent pareil.',
];

export function Souffle() {
  const [seances, setSeances] = usePersiste<SeanceSouffle[]>(CLES.souffle, []);
  const voix = useVoix();

  const [minutes, setMinutes] = useState<number>(1);
  const [durant, setDurant] = useState(false);
  const [ecoule, setEcoule] = useState(0);
  const debutRef = useRef(0);
  const minutesRef = useRef(minutes);

  // On garde la durée en ref : la séance en cours ne change pas de longueur
  // par surprise si l'utilisateur ajuste les boutons pendant l'exercice.
  useEffect(() => {
    if (!durant) minutesRef.current = minutes;
  }, [minutes, durant]);

  const horloge = useMemo(() => {
    if (!durant) return null;
    const phase = CYCLE[Math.floor(ecoule / DUREEUR_CYCLES) % CYCLE.length];
    const restant = phase.duree - (ecoule % DUREEUR_CYCLES);
    return {
      phase,
      restant: Math.max(1, restant),
      cycles: Math.floor(ecoule / DUREEUR_CYCLES),
      fraction: (ecoule % DUREEUR_CYCLES) / phase.duree,
      restantTotal: Math.max(0, Math.ceil(minutesRef.current * 60 - ecoule)),
    };
  }, [durant, ecoule]);

  /** Enregistre ce qui a déjà été souffle puis remet l'horloge à zéro. */
  const terminer = useCallback(
    (annonce: string) => {
      if (debutRef.current !== 0) {
        const minutesReelles = Math.max(0.5, Math.round(((Date.now() - debutRef.current) / 60_000) * 2) / 2);
        const seance: SeanceSouffle = {
          id: nouvelId(),
          date: aujourdhuiISO(),
          heure: heureISO(),
          minutes: minutesReelles,
        };
        setSeances((avant) => [seance, ...avant].slice(0, 60));
      }
      debutRef.current = 0;
      setDurant(false);
      setEcoule(0);
      voix.dire(annonce, 'bravo');
    },
    [voix, setSeances],
  );

  const demarrer = useCallback(() => {
    debutRef.current = Date.now();
    setEcoule(0);
    setDurant(true);
    voix.dire(
      `C'est parti : ${minutesRef.current} minute${minutesRef.current > 1 ? 's' : ''} de souffle, au rythme de vous.`,
    );
  }, [voix]);

  // Le cœur branle bas : une seule vigilance — le temps écoulé.
  useEffect(() => {
    if (!durant) return;
    const id = window.setInterval(() => {
      setEcoule(Math.floor((Date.now() - debutRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [durant]);

  // Fin naturelle de séance (durée choisie atteinte).
  useEffect(() => {
    if (!durant) return;
    if (ecoule > 0 && ecoule >= minutesRef.current * 60) {
      terminer(MOTS_APRES[Math.floor(Math.random() * MOTS_APRES.length)]);
    }
  }, [durant, ecoule, terminer]);

  const total = useMemo(() => {
    const depuis = new Date();
    depuis.setDate(depuis.getDate() - 6);
    depuis.setHours(0, 0, 0, 0);
    const recentes = seances.filter((s) => new Date(`${s.date}T${s.heure}:00`).getTime() >= depuis.getTime());
    return {
      nombre: recentes.length,
      minutes: Math.round(recentes.reduce((a, s) => a + s.minutes, 0) * 10) / 10,
      derniere: seances[0],
    };
  }, [seances]);

  return (
    <div className="sc-bloc">
      <Carte
        titre="Respirer, vraiment, trois fois rien"
        sousTitre="Un rythme simple : inspirer 4 secondes, pause 2 secondes, souffler 6."
      >
        <div className="sc-respire-zone">
          {/* Le cercle qui suit le souffle — purement décoratif, la consigne est ailleurs. */}
          <div className={`sc-respire ${horloge ? `sc-respire--${horloge.phase.cle}` : ''}`} aria-hidden="true">
            <svg viewBox="0 0 200 200" className="sc-respire__cercle">
              <circle cx="100" cy="100" r="92" className="sc-respire__anneau" />
              <circle
                cx="100"
                cy="100"
                r="72"
                className="sc-respire__disque"
                style={{
                  transform: `scale(${horloge ? 0.62 + horloge.fraction * 0.34 : 0.78})`,
                  transformOrigin: '50% 50%',
                  transition: 'transform 0.45s ease',
                }}
              />
            </svg>
            <span className="sc-respire__compte">{horloge ? horloge.restant : minutes}</span>
          </div>

          {/* Consigne vivante : re-dite à la synthèse vocale à chaque changement de phase. */}
          <p className="sc-respire__consigne" role="status" aria-live="polite">
            {horloge
              ? `${horloge.phase.consigne} (${horloge.restant} s)`
              : 'Choisissez une durée, puis un seul bouton pour commencer.'}
          </p>
          <p className="sc-respire__secondaire">
            {horloge
              ? [
                  horloge.cycles > 0
                    ? `${horloge.cycles} cycle${horloge.cycles > 1 ? 's' : ''} complet${horloge.cycles > 1 ? 's' : ''}`
                    : 'Le premier cycle arrive',
                  `encore ${Math.ceil(horloge.restantTotal / 60)} min${Math.ceil(horloge.restantTotal / 60) > 1 ? 's' : ''}`,
                ].join(' · ')
              : "Le cercle rend visible le mouvement. C'est tout — vous faites le reste."}
          </p>

          {!durant && (
            <div className="sc-choix" role="radiogroup" aria-label="Durée de la séance">
              {DUREES.map((d) => (
                <label
                  key={d.minutes}
                  className={`sc-choix__item sc-choix__item--large ${minutes === d.minutes ? 'sc-choix__item--actif' : ''}`}
                >
                  <input
                    type="radio"
                    name="sc-duree"
                    value={d.minutes}
                    checked={minutes === d.minutes}
                    onChange={() => setMinutes(d.minutes)}
                  />
                  <span className="sc-choix__mot">{d.mot}</span>
                  <span className="sc-choix__sous">{d.note}</span>
                </label>
              ))}
            </div>
          )}

          <div className="sc-actions">
            {durant ? (
              <button
                type="button"
                className="sc-btn sc-btn--principal sc-btn--grand"
                onClick={() => terminer('Séance posée là où elle en était. C’est déjà accordé')}
              >
                Arrêter — sagement
              </button>
            ) : (
              <button type="button" className="sc-btn sc-btn--principal sc-btn--grand" onClick={demarrer}>
                Commencer, doucement
              </button>
            )}
          </div>

          <Note>
            Aucune obligation d'arriver au bout : si vous arrêtez avant la fin, seules les minutes déjà soufflées sont comptées.
          </Note>
        </div>
      </Carte>

      {/* Exercice des sens : ancrer quand la tête s'emballe. */}
      <Carte
        titre="5-4-3-2-1 — se rattacher à l'ici"
        sousTitre="Un filet pour les moments de surcharge : passer par les sens, une liste à la fois."
      >
        <ol className="sc-ancrage">
          <li><strong>5 choses</strong> que vos yeux voient, très précisément ;</li>
          <li><strong>4 choses</strong> que vos mains ou vos pieds sentent ;</li>
          <li><strong>3 sons</strong> qui viennent doucement de la pièce ;</li>
          <li><strong>2 odeurs</strong> — ou 2 goûts qui reviennent à la bouche ;</li>
          <li><strong>1 grande respiration</strong>, pour finir en paix.</li>
        </ol>
        <Note>
          Si le poids persiste, ce n'est pas un échec : la pochette d'urgence
          recense les numéros gratuits où l'on écoute, jour et nuit.
        </Note>
      </Carte>

      {/* Impact : combien de pauses cette semaine. */}
      <Carte titre="Vos pauses cette semaine" sousTitre="Le cumul, sans effort, depuis 7 jours.">
        {total.nombre === 0 ? (
          <EtatVide
            illustration="souffle"
            titre="Aucune pause notée pour l'instant"
            texte="Une seule minute de respiration suffit à desserrer un peu. Essayez « 1 minute » pour voir."
          />
        ) : (
          <div className="sc-faits">
            <div className="sc-fait">
              <span className="sc-fait__nombre">{total.nombre}</span>
              <span className="sc-fait__libelle">
                pause{total.nombre > 1 ? 's' : ''} en 7 jours
                <em>chaque pause est déjà un choix de tendresse</em>
              </span>
            </div>
            <div className="sc-fait">
              <span className="sc-fait__nombre">≈ {total.minutes.toString().replace('.', ',')}</span>
              <span className="sc-fait__libelle">
                minutes de souffle
                <em>cumulées, sans aucun effort</em>
              </span>
            </div>
          </div>
        )}
        {total.nombre === 0 && total.derniere && (
          <p className="sc-mot-info">
            La dernière séance date du {dateLongue(total.derniere.date)} à {total.derniere.heure} —
            le souffle attend son tour, jamais en retard.
          </p>
        )}
      </Carte>
    </div>
  );
}
