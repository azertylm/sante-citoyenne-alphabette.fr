/**
 * scripts/pwa-icons.mjs
 *
 * Génère les icônes PNG du PWA (180/192/512) sans aucune dépendance :
 * un encodeur PNG pur (zlib de node) et le dessin d'un cœur blanc sur le
 * fond de la couleur d'identité (#155e75). Lancé à chaque `bun run build`
 * (prebuild) et à l'installation : `bun scripts/pwa-icons.mjs`.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(ici, '..', 'public');

/* --------------------------- PNG minimal --------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const contenu = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(contenu));
  return Buffer.concat([len, contenu, crc]);
}

/** Encode un tampon RGBA (w×h) en PNG couleur vraie. */
function encoderPNG(largeur, hauteur, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8;   // profondeur
  entete[9] = 6;   // RGBA
  entete[10] = 0;
  entete[11] = 0;
  entete[12] = 0;

  // Un octet de filtre 0 devant chaque ligne.
  const brut = Buffer.alloc(hauteur * (largeur * 4 + 1));
  for (let y = 0; y < hauteur; y += 1) {
    brut[y * (largeur * 4 + 1)] = 0;
    rgba.copy(brut, y * (largeur * 4 + 1) + 1, y * largeur * 4, (y + 1) * largeur * 4);
  }
  const idat = deflateSync(brut, { level: 9 });

  return Buffer.concat([signature, chunk('IHDR', entete), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* --------------------------- Le dessin ---------------------------- */

const FOND = [0x15, 0x5e, 0x75];     // bleu-vert du site — hérite de l'accent
const BLANC = [255, 255, 255];

/** Intérieur du cœur implicite (x² + y² − 1)³ − x²·y³ ≤ 0 — lobes en haut. */
function dansLeCoeur(px, py) {
  const a = px * px + py * py - 1;
  return a * a * a - px * px * py * py * py <= 0;
}

/** Bornes du cœur en repère unitaire (scan rapide) pour le centrer, quoi qu'il arrive. */
function bornesCoeur() {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = -1.6; y <= 1.6; y += 0.005) {
    for (let x = -1.6; x <= 1.6; x += 0.005) {
      if (dansLeCoeur(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

function dessiner(taille, chemin) {
  const rgba = Buffer.alloc(taille * taille * 4);
  const b = bornesCoeur();
  const largeur = b.maxX - b.minX;
  const hauteur = b.maxY - b.minY;
  // Le cœur occupe ~62 % du côté : zone sûre « maskable » confortable.
  const facteur = (taille * 0.62) / Math.max(largeur, hauteur);
  const centreUniteX = (b.minX + b.maxX) / 2;
  const centreUniteY = (b.minY + b.maxY) / 2;

  function touchant(xPix, yPix) {
    const px = (xPix - taille / 2) / facteur + centreUniteX;
    const py = -(yPix - taille / 2) / facteur + centreUniteY;
    return dansLeCoeur(px, py);
  }

  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      // Anti-crénelage : 4 échantillons par pixel.
      let touches = 0;
      for (const ox of [0.25, 0.75]) {
        for (const oy of [0.25, 0.75]) {
          if (touchant(x + ox, y + oy)) touches += 1;
        }
      }
      const i = (y * taille + x) * 4;
      if (touches === 0) {
        rgba[i] = FOND[0];
        rgba[i + 1] = FOND[1];
        rgba[i + 2] = FOND[2];
      } else {
        const part = touches / 4;
        rgba[i] = Math.round(FOND[0] * (1 - part) + BLANC[0] * part);
        rgba[i + 1] = Math.round(FOND[1] * (1 - part) + BLANC[1] * part);
        rgba[i + 2] = Math.round(FOND[2] * (1 - part) + BLANC[2] * part);
      }
      rgba[i + 3] = 255;
    }
  }

  writeFileSync(chemin, encoderPNG(taille, taille, rgba));
  console.log(`✅ icône ${taille}px → ${path.relative(publicDir, chemin)}`);
}

mkdirSync(path.join(publicDir, 'icons'), { recursive: true });
dessiner(180, path.join(publicDir, 'icons', 'icon-180.png'));
dessiner(192, path.join(publicDir, 'icons', 'icon-192.png'));
dessiner(512, path.join(publicDir, 'icons', 'icon-512.png'));
