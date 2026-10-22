/**
 * Santé Citoyenne — « Pochette » : le kit d'autonomie.
 *
 * Une pochette d'urgence imprimable (contacts, choses à emporter, consignes),
 * les numéros gratuits de secours, et l'espace « Données » : vie privée en
 * clair, export (emporter ses données), import, suppression totale.
 * Tout vit sur l'appareil, jamais ailleurs.
 */
import { useMemo, useRef, useState } from 'react';
import { Carte, Note, useVoix } from './commun';
import { ICroix, IExporter, IImprimer, IImporter, IPlus } from './icons';
import {
  appliquerSauvegarde, construireSauvegarde, effacerTout, telechargerSauvegarde, usePersiste, CLES,
} from './stockage';
import type { Contact, Pochette as PochetteData } from './types';

const NUMEROS = [
  { numero: '15', role: 'SAMU — urgence médicale' },
  { numero: '112', role: 'Urgences, partout en Europe, tous téléphones' },
  { numero: '17', role: 'Police — gendarmerie' },
  { numero: '18', role: 'Pompiers' },
  { numero: '114', role: 'Urgences par SMS (sourds et malentendants)' },
] as const;

const POCHETTE_VIDE: PochetteData = { contacts: [], litteries: [], consignes: '' };

export function PochetteSection() {
  const [pochette, setPochette] = usePersiste<PochetteData>(CLES.pochette, POCHETTE_VIDE);
  const voix = useVoix();

  /* --- Contacts ------------------------------------------------------ */
  const [nomContact, setNomContact] = useState('');
  const [roleContact, setRoleContact] = useState('');
  const [telContact, setTelContact] = useState('');
  const [erreurContact, setErreurContact] = useState('');

  function ajouterContact() {
    const nom = nomContact.trim();
    const tel = telContact.trim();
    if (!nom || !tel) {
      setErreurContact('Le nom et le numéro vont ensemble — c’est eux qu’on cherche dans l’urgence.');
      return;
    }
    setErreurContact('');
    setPochette((avant) => ({
      ...avant,
      contacts: [...avant.contacts, { id: nouvelIdContact(), nom, role: roleContact.trim(), telephone: tel }],
    }));
    setNomContact('');
    setRoleContact('');
    setTelContact('');
    voix.dire(`${nom} est dans la pochette. Bon réflexe.`, 'bravo');
  }

  /* --- Choses à emporter --------------------------------------------- */
  const [objet, setObjet] = useState('');

  function ajouterObjet() {
    const net = objet.trim();
    if (!net) return;
    setPochette((avant) => ({ ...avant, litteries: [...avant.litteries, net] }));
    setObjet('');
  }

  /* --- Données : export / import / suppression ------------------------ */
  const [importEnAttente, setImportEnAttente] = useState<{ nom: string; texte: string } | null>(null);
  const fichierRef = useRef<HTMLInputElement | null>(null);

  const blocs = useMemo(() => {
    let n = pochette.contacts.length + pochette.litteries.length;
    if (pochette.consignes.trim()) n += 1;
    return n;
  }, [pochette]);

  async function importer(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    const texte = await fichier.text();
    setImportEnAttente({ nom: fichier.name, texte });
    voix.dire(`${fichier.name} lu. Vérifiez ci-dessous avant de remplacer quoi que ce soit.`);
    if (fichierRef.current) fichierRef.current.value = '';
  }

  return (
    <div className="sc-bloc">
      <Carte
        titre="Ma pochette d'urgence"
        sousTitre="À préparer une fois, tranquillement : elle sera claire si le jour se complique."
      >
        <div className="sc-actions sc-actions--haut">
          <button
            type="button"
            className="sc-btn sc-btn--neutral"
            onClick={() => {
              window.print();
              voix.dire('Impression lancée — la pochette sort seule, le reste reste.');
            }}
          >
            <IImprimer taille={18} />
            Imprimer ma pochette
          </button>
        </div>

        <div className="sc-poche">
          {/* Contacts */}
          <fieldset className="sc-poche__bloc">
            <legend className="sc-poche__titre">Personnes à appeler</legend>
            {pochette.contacts.length === 0 ? (
              <p className="sc-poche__silence">
                Aucun contact pour l'instant. Pensez à une personne qui répond, et à sa relation avec vous.
              </p>
            ) : (
              <ul className="sc-poche__liste">
                {pochette.contacts.map((c: Contact) => (
                  <li key={c.id} className="sc-poche__ligne">
                    <span className="sc-poche__nom">{c.nom}</span>
                    {c.role && <span className="sc-poche__role">{c.role}</span>}
                    <a href={`tel:${c.telephone.replace(/\s+/g, '')}`} className="sc-poche__tel">{c.telephone}</a>
                  </li>
                ))}
              </ul>
            )}
            <div className="sc-ajout-ligne">
              <input
                className="sc-saisie"
                aria-label="Nom du contact"
                placeholder="Jeanne, la voisine"
                value={nomContact}
                onChange={(e) => { setNomContact(e.target.value); setErreurContact(''); }}
                maxLength={60}
                autoComplete="off"
              />
              <input
                className="sc-saisie"
                aria-label="Sa relation (facultatif)"
                placeholder="voisine"
                value={roleContact}
                onChange={(e) => setRoleContact(e.target.value)}
                maxLength={40}
                autoComplete="off"
              />
              <input
                className="sc-saisie"
                type="tel"
                aria-label="Numéro de téléphone"
                placeholder="06 12 34 56 78"
                value={telContact}
                onChange={(e) => { setTelContact(e.target.value); setErreurContact(''); }}
                maxLength={20}
              />
              <button
                type="button"
                className="sc-btn sc-btn--principal sc-ajout-ligne__bouton"
                onClick={ajouterContact}
              >
                <IPlus taille={18} />
                Ajouter
              </button>
            </div>
            {erreurContact && <p className="sc-alerte" role="alert">{erreurContact}</p>}
          </fieldset>

          {/* Choses à emporter */}
          <fieldset className="sc-poche__bloc">
            <legend className="sc-poche__titre">Ce qu'il faut emporter</legend>
            {pochette.litteries.length === 0 ? (
              <p className="sc-poche__silence">
                Pensez aux objets précieux : traitement du jour, carte vitale, eau, chargeur…
              </p>
            ) : (
              <ul className="sc-poche__liste sc-poche__liste--puces">
                {pochette.litteries.map((element, index) => (
                  <li key={`${element}-${index}`} className="sc-poche__objet">
                    {element}
                    <button
                      type="button"
                      className="sc-fermer"
                      aria-label={`Retirer ${element}`}
                      onClick={() => {
                        setPochette((avant) => ({
                          ...avant,
                          litteries: avant.litteries.filter((_, i) => i !== index),
                        }));
                      }}
                    >
                      <ICroix taille={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="sc-ajout-ligne">
              <input
                className="sc-saisie"
                aria-label="Ce qu'il faut emporter"
                placeholder="Traitement de 8 h, carte vitale…"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    ajouterObjet();
                  }
                }}
                maxLength={60}
              />
              <button
                type="button"
                className="sc-btn sc-btn--neutral sc-ajout-ligne__bouton"
                onClick={ajouterObjet}
              >
                <IPlus taille={18} />
                Ajouter
              </button>
            </div>
          </fieldset>

          {/* Consignes */}
          <fieldset className="sc-poche__bloc">
            <legend className="sc-poche__titre">Ce qu'il faut savoir de moi / de la personne aidée</legend>
            <textarea
              className="sc-saisie"
              rows={4}
              maxLength={500}
              placeholder="Allergies, traitement du matin, ce qui calme, l'adresse relais…"
              value={pochette.consignes}
              onChange={(e) => setPochette((avant) => ({ ...avant, consignes: e.target.value }))}
            />
          </fieldset>
        </div>

        <Note>
          La pochette s'imprime seule : seules ces trois zones sortent, à lire
          posée sur le réfrigérateur ou glissée dans un sac.
        </Note>
      </Carte>

      {/* Numéros publics — l'information qui sauve. */}
      <Carte
        titre="Numéros gratuits, 24 h sur 24"
        sousTitre="Ils ne remplacent jamais ceux que vous aimez ; ils répondent vite."
      >
        <ul className="sc-numeros">
          {NUMEROS.map((n) => (
            <li key={n.numero} className="sc-numero">
              <span className="sc-numero__chiffre">{n.numero}</span>
              <span className="sc-numero__role">{n.role}</span>
            </li>
          ))}
        </ul>
      </Carte>

      {/* Données & vie privée */}
      <Carte
        titre="Vos données, vos mains"
        sousTitre="Tout vit dans cet appareil : aucun compte, aucun envoi, aucune vente."
      >
        <ul className="sc-donnees">
          <li><strong>Aucun compte à créer.</strong> Ni adresse e-mail, ni mot de passe, ni identifiant publicitaire.</li>
          <li><strong>Le carnet, le souffle, la roue et la pochette restent ici.</strong> Rien n'est envoyé à un serveur — ni maintenant, ni plus tard.</li>
          <li><strong>La géolocalisation est facultative.</strong> Si vous posez « chez moi », c'est arrondi à 110 m et conservé sur l'appareil seulement.</li>
          <li><strong>Vous pouvez tout emporter ou tout effacer</strong>, en un instant, sans expliquer pourquoi.</li>
        </ul>

        <div className="sc-actions">
          <button
            type="button"
            className="sc-btn sc-btn--principal"
            onClick={() => {
              telechargerSauvegarde(construireSauvegarde());
              voix.dire('Sauvegarde prête dans vos téléchargements — à garder précieusement.', 'bravo');
            }}
          >
            <IExporter taille={18} />
            Emporter mes données (fichier)
          </button>
          <button
            type="button"
            className="sc-btn sc-btn--neutral"
            onClick={() => fichierRef.current?.click()}
          >
            <IImporter taille={18} />
            Remettre une sauvegarde
          </button>
          <input
            ref={fichierRef}
            type="file"
            accept="application/json,.json"
            className="sc-entree-fichier"
            aria-hidden="true"
            tabIndex={-1}
            onChange={importer}
          />
        </div>

        {importEnAttente && (
          <div className="sc-confirm" role="alert">
            <p>
              Remplacer les données de l'appareil par celles de
              <strong> {importEnAttente.nom}</strong> ? L'actuel sera écrasé —
              vérifiez que c'est bien votre sauvegarde.
            </p>
            <div className="sc-actions">
              <button
                type="button"
                className="sc-btn sc-btn--principal"
                onClick={() => {
                  const attente = importEnAttente;
                  setImportEnAttente(null);
                  const retour = appliquerSauvegarde(attente.texte);
                  voix.dire(retour.message, retour.ok ? 'bravo' : 'doux');
                  if (retour.ok) window.location.reload();
                }}
              >
                Oui, replacer
              </button>
              <button
                type="button"
                className="sc-btn sc-btn--txt"
                onClick={() => setImportEnAttente(null)}
              >
                Finalement, garder l'actuel
              </button>
            </div>
          </div>
        )}

        <EffacerTout
          onVaEffacer={() =>
            voix.dire('Tout a été effacé. L’appareil ne retient rien — c’était promis, c’est fait.')}
        />

        <Note>
          {blocs === 0
            ? 'Aucune donnée personnelle enregistrée pour l’instant : la page ne garde rien tant que vous n’écrivez rien.'
            : `${blocs} élément${blocs > 1 ? 's' : ''} enregistré${blocs > 1 ? 's' : ''} dans le stockage local de ce navigateur — et nulle part ailleurs.`}
        </Note>
      </Carte>
    </div>
  );
}

/** Identifiant d'urgence pour les contacts (prenom-free, court). */
function nouvelIdContact(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Suppression totale : deux temps posés, jamais un clic accidentel. */
function EffacerTout({ onVaEffacer }: { onVaEffacer: () => void }) {
  const [confirmee, setConfirmee] = useState(false);

  if (!confirmee) {
    return (
      <div className="sc-actions">
        <button
          type="button"
          className="sc-btn sc-btn--txt sc-btn--attention"
          onClick={() => setConfirmee(true)}
        >
          Effacer tout, pour de bon
        </button>
      </div>
    );
  }
  return (
    <div className="sc-confirm" role="alert">
      <p>
        Dernière vérification douce — <strong>tout</strong> (carnet, souffle, roue,
        pochette) sera supprimé, sans retour possible.
      </p>
      <div className="sc-actions">
        <button
          type="button"
          className="sc-btn sc-btn--grand sc-btn--principal"
          onClick={() => {
            effacerTout();
            onVaEffacer();
            window.location.reload();
          }}
        >
          Oui, tout effacer maintenant
        </button>
        <button type="button" className="sc-btn sc-btn--txt" onClick={() => setConfirmee(false)}>
          Finalement, garder mes données
        </button>
      </div>
    </div>
  );
}
