// Gera os ícones PNG do app a partir de src/app/icon.svg.
//
//   node scripts/gerar-icones.mjs
//
// Rode de novo sempre que o icon.svg mudar e faça commit dos PNGs.
import sharp from 'sharp';
import fs from 'fs';

const svg = fs.readFileSync('src/app/icon.svg');
fs.mkdirSync('public/icons', { recursive: true });

const out = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['src/app/apple-icon.png', 180],
];

for (const [file, size] of out) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(file);
  console.log('ok', file);
}
