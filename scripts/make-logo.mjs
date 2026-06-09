// Regenerate all Preppa brand rasters from the vector flame mark.
// The brand: a white lucide "flame" on an orange gradient tile (matches PreppaLogo).
// Run: node scripts/make-logo.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const IMG = join(__dir, '..', 'assets', 'images');

const ORANGE = '#F15F22';
const LIGHT = '#FF814A';
const DEEP = '#D94F14';
// lucide "flame", as a filled white shape
const FLAME =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z';

const grad = (id) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
     <stop offset="0" stop-color="${LIGHT}"/>
     <stop offset="0.55" stop-color="${ORANGE}"/>
     <stop offset="1" stop-color="${DEEP}"/>
   </linearGradient>`;

// White flame centered at fraction f of the canvas, nudged up slightly so it sits optically centered.
function flame(S, f) {
  const k = (S * f) / 24;
  const tx = (S - 24 * k) / 2;
  const ty = (S - 24 * k) / 2 - S * 0.015;
  return `<g transform="translate(${tx} ${ty}) scale(${k})"><path d="${FLAME}" fill="#fff"/></g>`;
}

const svgs = {
  // Full-bleed app icon (OS masks the corners itself)
  'icon.png': (S = 1024) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${grad('g')}</defs>` +
    `<rect width="${S}" height="${S}" fill="url(#g)"/>${flame(S, 0.52)}</svg>`,
  // Rounded tile mark — web favicon
  'favicon.png': (S = 196) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${grad('g')}</defs>` +
    `<rect width="${S}" height="${S}" rx="${S * 0.26}" fill="url(#g)"/>${flame(S, 0.56)}</svg>`,
  // Splash mark — visible on the white splash background, so it keeps the tile
  'splash-icon.png': (S = 512) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${grad('g')}</defs>` +
    `<rect width="${S}" height="${S}" rx="${S * 0.26}" fill="url(#g)"/>${flame(S, 0.56)}</svg>`,
  // Android adaptive foreground — white flame on transparent, inside the safe zone
  'android-icon-foreground.png': (S = 512) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${flame(S, 0.42)}</svg>`,
  // Android themed (monochrome) layer — flame silhouette the OS tints
  'android-icon-monochrome.png': (S = 512) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${flame(S, 0.42)}</svg>`,
  // Android adaptive background — orange gradient fill
  'android-icon-background.png': (S = 512) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${grad('g')}</defs>` +
    `<rect width="${S}" height="${S}" fill="url(#g)"/></svg>`,
  // Soft orange glow used behind the animated app icon
  'logo-glow.png': (S = 604) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>` +
    `<radialGradient id="r" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${LIGHT}" stop-opacity="0.85"/>` +
    `<stop offset="0.6" stop-color="${ORANGE}" stop-opacity="0.35"/>` +
    `<stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${S}" height="${S}" fill="url(#r)"/></svg>`,
  // Standalone mark for transactional emails
  'preppa-email-logo.png': (S = 512) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs>${grad('g')}</defs>` +
    `<rect width="${S}" height="${S}" rx="${S * 0.26}" fill="url(#g)"/>${flame(S, 0.56)}</svg>`,
};

for (const [name, make] of Object.entries(svgs)) {
  const svg = make();
  const size = Number(svg.match(/width="(\d+)"/)[1]);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(IMG, name));
  console.log('wrote', name, size + 'px');
}
console.log('done');
