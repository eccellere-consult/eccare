// Draws a profile picture for every demo person into public/demo/people/<key>.svg.
// Run with `node scripts/build-demo-portraits.mjs`; the output is committed.
// (Keys match lib/demo/cast.ts.)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'demo', 'people');
mkdirSync(root, { recursive: true });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SKINS = { a: '#e2b08a', b: '#d9a47c', c: '#c68a63', d: '#b9794f', e: '#a5673f' };
const HAIRS = { black: '#1c1a19', dark: '#2e2622', brown: '#4a3426', grey: '#b9b6b2', white: '#ecebea' };

function portrait(t) {
  const skin = SKINS[t.skin];
  const hair = HAIRS[t.hair];
  const shade = '#00000022';
  const greyish = t.hair === 'white' || t.hair === 'grey';
  const p = [];
  p.push(`<circle cx="100" cy="100" r="100" fill="${t.bg}"/>`);
  p.push('<g clip-path="url(#clip)">');
  // hair behind the head
  if (t.style === 'long') p.push(`<path d="M56 92 Q48 160 64 190 L136 190 Q152 160 144 92 Z" fill="${hair}"/>`);
  if (t.style === 'bun') p.push(`<circle cx="100" cy="36" r="17" fill="${hair}"/>`);
  if (t.style === 'ponytail') p.push(`<path d="M132 70 Q166 90 150 150 Q140 120 128 96 Z" fill="${hair}"/>`);
  if (t.scarf) p.push(`<path d="M52 100 Q50 38 100 36 Q150 38 148 100 Q150 150 126 178 L74 178 Q50 150 52 100 Z" fill="${t.scarf}"/>`);
  // shoulders and clothing
  p.push(`<path d="M22 200 Q26 148 100 142 Q174 148 178 200 Z" fill="${t.shirt}"/>`);
  if (t.coat) p.push(`<path d="M22 200 Q26 148 100 142 Q174 148 178 200 Z" fill="${t.coat}"/><path d="M100 146 L84 200 L116 200 Z" fill="${t.shirt}"/>`);
  if (t.nurse) p.push(`<rect x="94" y="164" width="12" height="3" fill="#c0392b"/><rect x="98.5" y="159.5" width="3" height="12" fill="#c0392b"/>`);
  // neck, ears, head
  p.push(`<rect x="84" y="118" width="32" height="34" rx="10" fill="${skin}"/><rect x="84" y="118" width="32" height="14" fill="${shade}"/>`);
  p.push(`<circle cx="62" cy="96" r="7" fill="${skin}"/><circle cx="138" cy="96" r="7" fill="${skin}"/>`);
  p.push(`<ellipse cx="100" cy="92" rx="38" ry="46" fill="${skin}"/>`);
  // hair on top
  if (!t.scarf) {
    if (t.style === 'bald') {
      p.push(`<ellipse cx="63" cy="88" rx="5" ry="14" fill="${hair}"/><ellipse cx="137" cy="88" rx="5" ry="14" fill="${hair}"/>`);
    } else {
      p.push(`<path d="M61 92 Q58 40 100 40 Q142 40 139 92 Q132 64 100 62 Q68 64 61 92 Z" fill="${hair}"/>`);
    }
  } else {
    p.push(`<path d="M62 84 Q66 52 100 50 Q134 52 138 84 Q124 64 100 64 Q76 64 62 84 Z" fill="${t.scarf}"/>`);
  }
  // face
  p.push(`<circle cx="86" cy="94" r="3.2" fill="#2b2220"/><circle cx="114" cy="94" r="3.2" fill="#2b2220"/>`);
  p.push(`<path d="M78 84 Q86 80 94 84 M106 84 Q114 80 122 84" stroke="${t.style === 'bald' || greyish ? '#8d8a86' : hair}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);
  p.push(`<path d="M100 98 Q96 108 101 111" stroke="#00000040" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  if (t.beard) p.push(`<path d="M63 98 Q62 142 100 143 Q138 142 137 98 Q126 122 100 122 Q74 122 63 98 Z" fill="${hair}" opacity="${t.beard === 'full' ? 0.92 : 0.4}"/>`);
  p.push(`<path d="M88 116 Q100 126 112 116" stroke="${t.beard === 'full' ? '#e8c9b0' : '#8a3b3b'}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
  if (t.stache) p.push(`<path d="M86 108 Q100 102 114 108 Q100 112 86 108 Z" fill="${hair}"/>`);
  if (t.bindi) p.push(`<circle cx="100" cy="72" r="3.4" fill="#b3261e"/>`);
  if (t.glasses) p.push(`<g fill="none" stroke="#3a3a3a" stroke-width="2.4"><circle cx="86" cy="94" r="11"/><circle cx="114" cy="94" r="11"/><path d="M97 94 Q100 91 103 94"/><path d="M75 92 L64 88 M125 92 L136 88"/></g>`);
  if (t.cap) p.push(`<path d="M64 70 Q100 30 136 70 Q100 60 64 70 Z" fill="${t.cap}"/>`);
  p.push('</g>');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="${esc(t.label)}"><defs><clipPath id="clip"><circle cx="100" cy="100" r="100"/></clipPath></defs>${p.join('')}</svg>\n`;
}

const bgs = ['#dfeef0', '#f6e7cf', '#e5eadb', '#f0dfe3', '#e3e3f2', '#f3e9dd'];
const people = {
  elder: { skin: 'b', hair: 'grey', style: 'bun', glasses: 1, bindi: 1, shirt: '#e9e2c9', },
  family: { skin: 'c', hair: 'black', style: 'short', glasses: 1, beard: 'stubble', shirt: '#2f6f8f' },
  divya: { skin: 'b', hair: 'black', style: 'long', bindi: 1, shirt: '#c0392b' },
  pharmacy: { skin: 'd', hair: 'dark', style: 'short', stache: 1, shirt: '#3b6d11', coat: '#eef5ea' },
  raghavan: { skin: 'c', hair: 'white', style: 'short', glasses: 1, stache: 1, shirt: '#f1efe6' },
  mini: { skin: 'a', hair: 'dark', style: 'long', bindi: 1, shirt: '#2a7f62' },
  haridas: { skin: 'c', hair: 'grey', style: 'short', glasses: 1, shirt: '#5a6b8a' },
  sheela: { skin: 'b', hair: 'dark', style: 'bun', bindi: 1, shirt: '#b5651d' },
  girija: { skin: 'b', hair: 'grey', style: 'bun', glasses: 1, bindi: 1, shirt: '#6b4a8f' },
  abhijith: { skin: 'c', hair: 'black', style: 'short', beard: 'stubble', shirt: '#3a7d44' },
  fathima: { skin: 'a', hair: 'dark', style: 'long', scarf: '#6a8e7f', shirt: '#6a8e7f' },
  george: { skin: 'a', hair: 'white', style: 'bald', glasses: 1, shirt: '#8a6b3a' },
  venkatesh: { skin: 'c', hair: 'grey', style: 'short', stache: 1, shirt: '#2e5d7a' },
  annamma: { skin: 'a', hair: 'white', style: 'bun', glasses: 1, shirt: '#a24d6b' },
  rahul: { skin: 'c', hair: 'black', style: 'short', beard: 'full', shirt: '#d9822b' },
  basheer: { skin: 'd', hair: 'white', style: 'short', beard: 'full', cap: '#f4f1ea', shirt: '#4a7a6b' },
  anjana: { skin: 'b', hair: 'black', style: 'long', bindi: 1, shirt: '#3b6d8f' },
  francis: { skin: 'a', hair: 'white', style: 'bald', shirt: '#7a3f3f' },
  kamini: { skin: 'a', hair: 'white', style: 'short', glasses: 1, bindi: 1, shirt: '#8a3f6b' },
  biju: { skin: 'd', hair: 'black', style: 'short', stache: 1, shirt: '#556b2f' },
  shahul: { skin: 'b', hair: 'black', style: 'short', beard: 'full', cap: '#f4f1ea', shirt: '#3a5a8a' },
  doctor: { skin: 'b', hair: 'black', style: 'bun', bindi: 1, shirt: '#2a7f9f', coat: '#f4f8fa' },
  auto: { skin: 'd', hair: 'dark', style: 'short', stache: 1, shirt: '#caa43a' },
  legal: { skin: 'c', hair: 'grey', style: 'short', glasses: 1, shirt: '#2a2f4a' },
  insurance: { skin: 'b', hair: 'dark', style: 'long', shirt: '#7a2f4a' },
  property: { skin: 'c', hair: 'dark', style: 'short', stache: 1, shirt: '#3a6a5a' },
  nursing: { skin: 'a', hair: 'dark', style: 'bun', shirt: '#e8eef2', nurse: 1 },
  grocery: { skin: 'd', hair: 'dark', style: 'short', beard: 'full', cap: '#f4f1ea', shirt: '#4a8a3a' },
  physio: { skin: 'b', hair: 'black', style: 'ponytail', shirt: '#2f8a8a' },
  companion: { skin: 'a', hair: 'grey', style: 'bun', shirt: '#c07a3a' },
  ayurveda: { skin: 'a', hair: 'dark', style: 'short', bindi: 1, shirt: '#f4efe0' },
  quickcure: { skin: 'b', hair: 'black', style: 'short', beard: 'full', shirt: '#4a4a4a' },
  drjoseph: { skin: 'a', hair: 'grey', style: 'short', glasses: 1, shirt: '#2a5d7a', coat: '#f4f8fa' },
  drshamina: { skin: 'a', hair: 'dark', style: 'long', scarf: '#8a4f6b', shirt: '#8a4f6b', coat: '#f4f8fa' },
};

let i = 0;
for (const [key, t] of Object.entries(people)) {
  writeFileSync(join(root, `${key}.svg`), portrait({ bg: bgs[i % bgs.length], label: key, ...t }));
  i++;
}
console.log(`Portraits written: ${i}`);
