/**
 * scripts/apercu-cdp.mjs
 *
 * Aperçu automatisé de l'application via Chrome DevTools Protocol :
 *   bun scripts/apercu-cdp.mjs "<scénario>" "<fichier-sortie.png>"
 *
 * Scénarios disponibles :
 *   journal | journal-nuit | souffle | souffle-nuit | entourage | entourage-nuit
 *   pochette | pochette-nuit | interaction  (saisie réelle + notification)
 *
 * Le script lance un Chrome headless, pose l'état local (thème, données),
 * effectue les clics, et capture la page entière. Sert uniquement au rituel
 * de livraison (règle nº 7 : joindre un aperçu réel).
 */
import { spawn } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DECISIONS = process.argv[2] ?? 'journal';
const SORTIE = process.argv[3] ?? null;

const CHROMES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const URL_APP = process.env.APERCU_URL ?? 'http://localhost:5176';
const PORT = 9333;

/** Attendre que le port CDP réponde. */
async function attendrePort(ms = 15_000) {
  const debut = Date.now();
  while (Date.now() - debut < ms) {
    try {
      const reponse = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (reponse.ok) return;
    } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Chrome (CDP) ne répond pas');
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------- lancement de Chrome */

const profile = path.join(process.env.TEMP ?? '/tmp', `apercu-cdp-${Date.now()}`);
const executable = CHROMES.find((p) => p.length > 0);

const chromeProcess = spawn(executable, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--remote-debugging-port=' + PORT,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--window-size=1024,1400',
  'about:blank',
], { stdio: 'ignore' });

process.on('exit', () => chromeProcess.kill());

/* --------------------------------------------- client WebSocket minimal */

/** Messages JSON-RPC sur le socket CDP, avec file d'attente d'événements. */
function connecterCDP(wsUrl) {
  return new Promise((resoudre, rejeter) => {
    const ws = new WebSocket(wsUrl);
    let compteur = 0;
    const enAttente = new Map();
    ws.onopen = () => resoudre({
      async envoyer(method, params = {}) {
        compteur += 1;
        const id = compteur;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((r, rej) => enAttente.set(id, { r, rej }));
      },
      fermer() { ws.close(); },
    });
    ws.onerror = (e) => rejeter(new Error('WS: ' + (e?.message ?? 'erreur')));
    ws.onmessage = (ev) => {
      const message = JSON.parse(String(ev.data));
      if (message.id && enAttente.has(message.id)) {
        const { r, rej } = enAttente.get(message.id);
        enAttente.delete(message.id);
        if (message.error) rej(new Error(message.error.message));
        else r(message.result);
      }
    };
    ws.onclose = () => {
      for (const [, { rej }] of enAttente) rej(new Error('socket fermé'));
    };
  });
}

/* ------------------------------------------------------------ scénarios */

const THÈMES_PAR_SCÉNARIO = {
  journal: 'clear', souffle: 'clear', entourage: 'clear', pochette: 'clear', interaction: 'clear',
  'journal-nuit': 'nuit', 'souffle-nuit': 'nuit', 'entourage-nuit': 'nuit', 'pochette-nuit': 'nuit',
};

const EVALUÉS_PAR_SCÉNARIO = {
  journal: 'null',
  souffle: 'document.querySelectorAll(\'.sc-nav__bouton\')[1].click()',
  entourage: 'document.querySelectorAll(\'.sc-nav__bouton\')[2].click()',
  pochette: 'document.querySelectorAll(\'.sc-nav__bouton\')[3].click()',
  interaction: `
    (() => {
      document.querySelectorAll('.sc-nav__bouton')[0].click();
      const boutons = [...document.querySelectorAll('.sc-choix__item')];
      boutons[3].click();      // énergie « Bonne »
      const core = document.querySelectorAll('[role=radiogroup]')[1];
      core.querySelectorAll('.sc-choix__item')[0].click(); // humeur « Serein »
      document.querySelector('.sc-puce input[type=checkbox]').click();
      document.querySelector('.sc-saisie#sc-mot').value = 'A traversé la journée avec douceur';
      document.querySelector('form button[type=submit]').click();
    })()` , // évalué APRÈS le premier rendu; la saisie se fait sur le DOM réel
};

/* ------------------------------------------------------------------ main */

async function principal() {
  await attendrePort();
  const cibles = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = cibles.find((c) => c.type === 'page');
  const cdp = await connecterCDP(page.webSocketDebuggerUrl);

  await cdp.envoyer('Page.enable');
  await cdp.envoyer('Runtime.enable');
  await cdp.envoyer('Emulation.setDeviceMetricsOverride', {
    width: DECISIONS.includes('mobile') ? 390 : 1024,
    height: 1500,
    deviceScaleFactor: 1,
    mobile: DECISIONS.includes('mobile'),
  });

  const theme = THÈMES_PAR_SCÉNARIO[DECISIONS] ?? 'clear';

  // État local AVANT le chargement de l'app (le thème est lu au premier rendu).
  await cdp.envoyer('Page.navigate', { url: `${URL_APP}/` });
  await attendre(1200);

  if (theme === 'nuit') {
    await cdp.envoyer('Runtime.evaluate', { expression: "localStorage.setItem('alphabette.shell.theme','nuit')" });
  } else {
    await cdp.envoyer('Runtime.evaluate', { expression: "localStorage.removeItem('alphabette.shell.theme')" });
  }
  // Re-chargement avec l'état posé.
  await cdp.envoyer('Page.navigate', { url: `${URL_APP}/` });
  await attendre(1600);

  const evalClic = EVALUÉS_PAR_SCÉNARIO[DECISIONS.replace(/-nuit$/, '')] ?? 'null';
  if (evalClic && evalClic !== 'null') {
    await cdp.envoyer('Runtime.evaluate', { expression: evalClic });
    await attendre(500);
  }
  if (DECISIONS === 'interaction') {
    // Le geste complet : choisir énergie, humeur, une balise, un mot — puis envoyer.
    await cdp.envoyer('Runtime.evaluate', { expression: `
      (() => {
        const groupes = document.querySelectorAll('[role=radiogroup]');
        groupes[0]?.querySelectorAll('.sc-choix__item')[3]?.click();
        groupes[1]?.querySelectorAll('.sc-choix__item')[0]?.click();
        const puces = [...document.querySelectorAll('.sc-puce input[type=checkbox]')];
        puces[2]?.click();
        const zone = document.querySelector('#sc-mot');
        if (zone) {
          zone.value = 'Tenue du soir inconnue, mais respirations OK';
          zone.dispatchEvent(new Event('input', { bubbles: true }));
        }
        document.querySelector('form button[type=submit]')?.click();
      })()` });
    await attendre(900);
  }

  // Mesure de la page entière puis capture.
  const m = await cdp.envoyer('Runtime.evaluate', {
    expression: "JSON.stringify({ L: document.documentElement.scrollWidth, H: document.documentElement.scrollHeight })",
    returnByValue: true,
  });
  const { L, H } = JSON.parse(m.result.value);

  // La barre d'onglets est fixe : pour une capture fidèle, la hauteur de la
  // vue doit égaler celle de la page (sinon Chrome écrase la barre sur le
  // contenu dans l'image pleine page). On réajuste puis on re-mesure.
  const hauteurVue = Math.min(Math.max(H, 700), 9000);
  await cdp.envoyer('Emulation.setDeviceMetricsOverride', {
    width: DECISIONS.includes('mobile') ? 390 : 1024,
    height: hauteurVue,
    deviceScaleFactor: 1,
    mobile: DECISIONS.includes('mobile'),
  });
  await attendre(200);
  const m2 = await cdp.envoyer('Runtime.evaluate', {
    expression: "JSON.stringify({ L: document.documentElement.scrollWidth, H: document.documentElement.scrollHeight })",
    returnByValue: true,
  });
  const { L: L2, H: H2 } = JSON.parse(m2.result.value);

  const image = await cdp.envoyer('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: L2, height: Math.min(H2, 9000), scale: 1 },
  });
  const tampon = Buffer.from(image.data, 'base64');
  mkdirSync(path.join(process.env.TEMP ?? '/tmp', 'opencode', 'apercus'), { recursive: true });
  const dest = SORTIE ?? path.join(process.env.TEMP ?? '/tmp', 'opencode', 'apercus', `${DECISIONS}.png`);
  writeFileSync(dest, tampon);
  console.log(`✅ capture « ${DECISIONS} » → ${dest} (${tampon.length} octets, page ${L}×${H})`);

  cdp.fermer();
  chromeProcess.kill();
}

principal().catch((erreur) => {
  console.error('❌', erreur.message);
  try { chromeProcess.kill(); } catch { /* déjà parti */ }
  process.exit(1);
});
