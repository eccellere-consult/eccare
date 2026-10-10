// Generates the illustrations and PDFs the demo data points at, into public/demo/.
// Run once with `node scripts/build-demo-assets.mjs`; the output is committed so the
// deployed app can serve it (there is no object storage to upload demo files to).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'demo');
const out = (rel, content) => {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ─── SVG scenes ────────────────────────────────────────────────────────────

function scene({ w = 800, h = 600, sky, ground, caption, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(caption)}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
<linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ground[0]}"/><stop offset="1" stop-color="${ground[1]}"/></linearGradient>
</defs>
<rect width="${w}" height="${h}" fill="url(#sky)"/>
${body}
</svg>
`;
}

const person = (x, y, s, skin, shirt) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-62" r="18" fill="${skin}"/><path d="M-26 40 Q-26 -36 0 -36 Q26 -36 26 40 Z" fill="${shirt}"/></g>`;
const tree = (x, y, s, c) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-7" y="0" width="14" height="60" fill="#6b4a2b"/><circle cx="0" cy="-8" r="44" fill="${c}"/><circle cx="-30" cy="14" r="30" fill="${c}"/><circle cx="30" cy="14" r="30" fill="${c}"/></g>`;
const diya = (x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="26" ry="11" fill="#c2652a"/><path d="M-26 0 Q0 22 26 0 Z" fill="#a24d1c"/><path d="M0 -8 Q-9 -26 0 -44 Q9 -26 0 -8 Z" fill="#ffd54a"/><circle cx="0" cy="-20" r="34" fill="#ffd54a" opacity="0.18"/></g>`;

const memories = {
  diwali: scene({
    sky: ['#1b1a3a', '#3b2a55'], ground: ['#3a2a40', '#1b1a2a'], caption: 'Diwali evening at home',
    body: `<rect y="380" width="800" height="162" fill="url(#gr)"/>` +
      [90, 220, 350, 480, 610, 720].map((x, i) => diya(x, 440 + (i % 2) * 28, 1.1)).join('') +
      `<g fill="#ffd54a" opacity="0.9"><circle cx="140" cy="120" r="3"/><circle cx="300" cy="80" r="2.5"/><circle cx="520" cy="140" r="3"/><circle cx="660" cy="90" r="2"/><circle cx="420" cy="200" r="2"/></g>` +
      person(330, 360, 1.6, '#e0ac82', '#d9534f') + person(450, 366, 1.5, '#c68a63', '#2a7f62'),
  }),
  grandkids: scene({
    sky: ['#9ed8f0', '#e8f6fb'], ground: ['#8fcf7a', '#5ea84a'], caption: 'The grandchildren visit',
    body: `<circle cx="680" cy="110" r="52" fill="#ffe27a"/><rect y="400" width="800" height="142" fill="url(#gr)"/>` +
      person(260, 440, 1.7, '#e0ac82', '#f08a24') + person(380, 452, 1.1, '#e8b996', '#3c8dbc') +
      person(450, 458, 0.95, '#e8b996', '#d65a8b') + person(540, 440, 1.7, '#a9744f', '#6a5acd'),
  }),
  lalbagh: scene({
    sky: ['#bfe3f2', '#f1f8e9'], ground: ['#9ccc65', '#689f38'], caption: 'Morning walk at Lalbagh',
    body: `<rect y="380" width="800" height="162" fill="url(#gr)"/><path d="M300 542 Q400 440 480 380 L520 380 Q470 450 520 542 Z" fill="#d9c7a0"/>` +
      tree(110, 330, 1.5, '#2e7d32') + tree(250, 350, 1.2, '#388e3c') + tree(640, 320, 1.7, '#2e7d32') + tree(730, 360, 1.1, '#43a047') +
      person(430, 450, 1.1, '#e0ac82', '#8e44ad'),
  }),
  anniversary: scene({
    sky: ['#fce4d6', '#fff4ea'], ground: ['#b5835a', '#8d6139'], caption: 'Anniversary lunch with family',
    body: `<rect y="330" width="800" height="212" fill="url(#gr)"/><ellipse cx="400" cy="430" rx="300" ry="64" fill="#f4e8d8"/>` +
      [220, 330, 440, 550].map((x) => `<ellipse cx="${x}" cy="430" rx="38" ry="14" fill="#fff"/><ellipse cx="${x}" cy="427" rx="26" ry="8" fill="#e8b04a"/>`).join('') +
      `<rect x="385" y="372" width="30" height="42" rx="4" fill="#c0392b"/><path d="M400 372 Q392 356 400 342 Q408 356 400 372Z" fill="#ffd54a"/>` +
      person(190, 320, 1.4, '#e0ac82', '#2a7f62') + person(610, 320, 1.4, '#c68a63', '#d9534f'),
  }),
  temple: scene({
    sky: ['#f7c873', '#fbe9c4'], ground: ['#c9a86a', '#a98348'], caption: 'Temple visit, Mysuru',
    body: `<rect y="440" width="800" height="102" fill="url(#gr)"/>` +
      [0, 1, 2, 3, 4].map((i) => `<rect x="${300 + i * 6}" y="${150 + i * 54}" width="${200 - i * 12}" height="54" fill="${i % 2 ? '#b8532a' : '#d2693a'}"/>`).join('') +
      `<path d="M388 150 L400 112 L412 150Z" fill="#ffd54a"/><rect x="372" y="396" width="56" height="48" fill="#4a2a18"/>` +
      person(210, 470, 1.2, '#e0ac82', '#c0392b') + person(580, 474, 1.2, '#c68a63', '#2c6e8f'),
  }),
  birthday: scene({
    sky: ['#d9c7f2', '#f5eefc'], ground: ['#cdb4e8', '#a98ccc'], caption: 'Turning 72',
    body: `<rect y="420" width="800" height="122" fill="url(#gr)"/><rect x="310" y="330" width="180" height="90" rx="10" fill="#f6d5c0"/><rect x="310" y="330" width="180" height="26" rx="10" fill="#e96a8d"/>` +
      [340, 380, 420, 460].map((x) => `<rect x="${x}" y="296" width="8" height="36" fill="#4aa3df"/><path d="M${x + 4} 296 Q${x - 4} 282 ${x + 4} 268 Q${x + 12} 282 ${x + 4} 296Z" fill="#ffd54a"/>`).join('') +
      `<g fill="#e96a8d"><circle cx="120" cy="140" r="24"/><circle cx="170" cy="180" r="22" fill="#4aa3df"/><circle cx="660" cy="150" r="26" fill="#ffd54a"/><circle cx="700" cy="210" r="22"/></g>` +
      person(210, 420, 1.5, '#e0ac82', '#2a7f62') + person(600, 424, 1.5, '#c68a63', '#6a5acd'),
  }),
};
for (const [name, svg] of Object.entries(memories)) out(`memories/${name}.svg`, svg);

// ─── Document-like SVGs ───────────────────────────────────────────────────

function sheet({ title, lines, accent = '#0B5563', w = 700, h = 900 }) {
  const body = lines
    .map((l, i) => {
      const y = 190 + i * 38;
      const bold = l.startsWith('**');
      const text = esc(bold ? l.slice(2) : l);
      return `<text x="60" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${bold ? 22 : 20}" font-weight="${bold ? 700 : 400}" fill="#1f2a30">${text}</text>`;
    })
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<rect width="${w}" height="${h}" fill="#fbfaf6"/>
<rect x="0" y="0" width="${w}" height="110" fill="${accent}"/>
<text x="60" y="68" font-family="Georgia, serif" font-size="34" fill="#fff">${esc(title)}</text>
<line x1="60" y1="130" x2="${w - 60}" y2="130" stroke="${accent}" stroke-width="2"/>
${body}
<text x="60" y="${h - 36}" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#8a949a">Sample document created for the EC demo</text>
</svg>
`;
}

out('rx/rx-bhat.svg', sheet({
  title: 'Dr. Ramesh Bhat, MD',
  lines: ['**General Physician - Indiranagar Clinic', 'Patient: Lakshmi Narayanan   Age: 72   F', '', '**Rx', '1. Tab Telmisartan 40 mg   1-0-0   after breakfast', '2. Tab Metformin 500 mg   1-0-1   after food', '3. Tab Atorvastatin 10 mg   0-0-1   at night', '4. Tab Ecosprin 75 mg   0-1-0   after lunch', '5. Tab Calcium + D3   0-1-0   after lunch', '', 'Review after 4 weeks with HbA1c, lipid profile.', 'Low salt, low sugar diet. Walk 30 minutes daily.'],
}));
out('rx/rx-cardio.svg', sheet({
  title: 'Dr. Meenakshi Rao, DM Cardiology',
  accent: '#7a1f2b',
  lines: ['**Cardiology OPD - Manipal Hospital', 'Patient: Lakshmi Narayanan   Age: 72   F', '', '**Rx', '1. Tab Amlodipine 5 mg   0-0-1   at night', '2. Eye drops Timolol 0.5%   1 drop both eyes, morning and night', '', 'BP 134/82 today. Echo normal, EF 60%.', 'Continue present medicines. Review in 3 months.'],
}));

function card({ title, lines, c1, c2 }) {
  const body = lines.map((l, i) => `<text x="40" y="${130 + i * 34}" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#fff">${esc(l)}</text>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380" width="640" height="380" role="img" aria-label="${esc(title)}">
<defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="640" height="380" rx="22" fill="url(#c)"/>
<text x="40" y="70" font-family="Georgia, serif" font-size="32" fill="#fff" font-weight="700">${esc(title)}</text>
${body}
<rect x="40" y="300" width="90" height="42" rx="6" fill="rgba(255,255,255,0.25)"/>
<text x="470" y="336" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#fff" opacity="0.8">Sample card - demo data</text>
</svg>
`;
}
out('cards/health-plan.svg', card({ title: 'Manipal Senior Health Plan', lines: ['Member: Lakshmi Narayanan', 'Plan ID: MSH-4471-2290', 'Valid till: 31 Mar 2027', 'Helpline: 080 4000 1111'], c1: '#0B5563', c2: '#2a8a96' }));
out('cards/insurance.svg', card({ title: 'Senior Red Carpet Policy', lines: ['Insured: Lakshmi Narayanan', 'Policy No: P/211111/01/2026/003481', 'Sum insured: Rs 10,00,000', 'Renewal: 14 Aug 2027'], c1: '#854F0B', c2: '#c77a1f' }));

// ─── Catalog / marketplace / rental / inspection tiles ────────────────────

const tile = (label, c1, c2, glyph) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360" role="img" aria-label="${esc(label)}">
<defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="480" height="360" fill="url(#t)"/>${glyph}
<text x="240" y="322" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#fff">${esc(label)}</text>
</svg>
`;
const g = {
  medicine: `<rect x="190" y="90" width="100" height="130" rx="14" fill="#fff"/><rect x="190" y="90" width="100" height="40" rx="14" fill="#e8f5f7"/><rect x="232" y="140" width="16" height="60" fill="#0B5563"/><rect x="210" y="162" width="60" height="16" fill="#0B5563"/>`,
  device: `<rect x="170" y="100" width="140" height="110" rx="16" fill="#fff"/><circle cx="240" cy="150" r="30" fill="#e8f5f7" stroke="#0B5563" stroke-width="6"/><path d="M225 150 L237 162 L258 138" stroke="#0B5563" stroke-width="7" fill="none"/>`,
  care: `<path d="M240 210 C170 160 190 100 240 130 C290 100 310 160 240 210Z" fill="#fff"/>`,
  food: `<ellipse cx="240" cy="190" rx="100" ry="28" fill="#fff"/><path d="M150 190 Q240 80 330 190Z" fill="#f7d58a"/><circle cx="240" cy="110" r="10" fill="#fff"/>`,
  wellness: `<circle cx="240" cy="140" r="26" fill="#fff"/><path d="M240 166 L240 230 M190 190 L290 190 M240 230 L206 270 M240 230 L274 270" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none"/>`,
  home: `<path d="M150 200 L240 110 L330 200Z" fill="#fff"/><rect x="180" y="200" width="120" height="80" fill="#fff"/><rect x="224" y="230" width="32" height="50" fill="#854F0B"/>`,
};
const tiles = [
  ['catalog/medicine', 'Medicines', '#0B5563', '#2f9aa8', g.medicine],
  ['catalog/device', 'Health devices', '#3B6D11', '#6aa532', g.device],
  ['catalog/care', 'Daily care', '#854F0B', '#c98a3f', g.care],
  ['catalog/food', 'Diabetic-friendly food', '#a8541f', '#e08d4a', g.food],
  ['catalog/wellness', 'Wellness', '#4a3f8f', '#7a6fcf', g.wellness],
  ['catalog/home', 'Home essentials', '#2f5d7a', '#5a93b5', g.home],
  ['market/sofa', 'Two-seater sofa', '#8a5a3c', '#b98a63', g.home],
  ['market/walker', 'Folding walker', '#3a6b78', '#6fa2b0', g.device],
  ['market/bicycle', 'Exercise cycle', '#5a3f8f', '#8a6fcf', g.wellness],
  ['market/books', 'Kannada novels', '#7a3f3f', '#b86a6a', g.care],
  ['rentals/ground-floor', 'Ground-floor 2BHK', '#2e6b4f', '#62a584', g.home],
  ['rentals/room', 'Sunny room with ramp', '#3a5d8a', '#6f93c4', g.home],
  ['rentals/villa', 'Independent house', '#8a4f2e', '#c18560', g.home],
  ['inspection/plumbing', 'Kitchen plumbing', '#2f5d7a', '#5a93b5', g.care],
  ['inspection/electrical', 'Distribution board', '#8a6b1f', '#c9a03c', g.device],
  ['inspection/wall', 'Bedroom wall seepage', '#6b4a3a', '#a07860', g.home],
];
for (const [path, label, c1, c2, glyph] of tiles) out(`${path}.svg`, tile(label, c1, c2, glyph));

// ─── PDFs (minimal, text only) ────────────────────────────────────────────

function pdf(title, paragraphs) {
  const lines = [];
  for (const p of paragraphs) {
    if (p === '') { lines.push(''); continue; }
    const bold = p.startsWith('**');
    const text = bold ? p.slice(2) : p;
    const words = text.split(' ');
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > 88) { lines.push((bold ? '**' : '') + cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    lines.push((bold ? '**' : '') + cur);
  }
  const pdfEsc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
  const perPage = 44;
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (pages.length === 0) pages.push([]);

  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('PLACEHOLDER_PAGES');
  const fontReg = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];
  pages.forEach((pg, idx) => {
    let stream = 'BT\n';
    if (idx === 0) stream += `/F2 20 Tf\n56 790 Td\n(${pdfEsc(title)}) Tj\n0 -34 Td\n`;
    else stream += '56 790 Td\n';
    for (const l of pg) {
      const bold = l.startsWith('**');
      stream += `/${bold ? 'F2' : 'F1'} ${bold ? 12 : 11} Tf\n(${pdfEsc(bold ? l.slice(2) : l)}) Tj\n0 -16 Td\n`;
    }
    stream += 'ET\n';
    const contentId = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`);
    const pageId = add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objs[1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let body = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'binary');
}

out('docs/bylaws.pdf', pdf('Sunrise Residency - Association Bye-laws', [
  '**1. Name and objects',
  'The association is called the Sunrise Residency Owners and Residents Association. Its objects are to maintain the common areas and services, to protect the safety and comfort of all residents, and to promote harmony among members.',
  '', '**2. Membership',
  'Every owner or tenant of a flat is a member. Each flat has one vote, exercised by the owner or the nominated adult resident of the flat.',
  '', '**3. Managing committee',
  'A committee of seven members is elected at the Annual General Meeting for a term of two years. The committee elects a President, Secretary and Treasurer from among its members.',
  '', '**4. Maintenance charges',
  'Monthly maintenance is payable by the 10th of each month. Charges are fixed by the general body. Delays beyond 30 days may attract interest as resolved by the committee.',
  '', '**5. Safety and quiet hours',
  'Quiet hours are 10:00 PM to 6:00 AM. Vehicles must be parked only in allotted slots. Elders living alone are encouraged to register with the committee so neighbours can look in on them.',
  '', '**6. Amendments',
  'These bye-laws may be amended by a two-thirds majority of the members present at a general meeting called for the purpose.',
]));
out('docs/agm-minutes.pdf', pdf('Minutes of the Annual General Meeting - 14 June 2026', [
  'Venue: Clubhouse, Sunrise Residency.   Present: 58 flats represented.   Chair: Mrs Meera Nair, Secretary.',
  '', '**Item 1 - Accounts for 2025-26',
  'The Treasurer presented the audited accounts. Maintenance collected was Rs 22.4 lakh against expenses of Rs 20.9 lakh. The accounts were adopted unanimously.',
  '', '**Item 2 - Lift modernisation',
  'The house approved replacing the controller in Block B lift at an estimated Rs 4.2 lakh, to be funded from the sinking fund.',
  '', '**Item 3 - Security',
  'Night patrolling will be doubled. A panic button linked to the EC community app was demonstrated and all residents were encouraged to install it.',
  '', '**Item 4 - Senior residents',
  'The committee will keep a confidential list of residents over 70 living alone and nominate a volunteer buddy for each.',
  '', '**Item 5 - Any other business',
  'Request to repaint the clubhouse noted. Meeting closed at 12:40 PM with a vote of thanks.',
]));
out('docs/water-tank-notice.pdf', pdf('Notice - Water tank cleaning', [
  'All residents are informed that the overhead and sump tanks will be cleaned on Saturday from 9:00 AM to 3:00 PM.',
  '', 'Water supply will be interrupted during this period. Please store drinking water in advance.',
  '', 'Residents on the ground floor may collect drinking water from the clubhouse tap. Volunteers will help senior residents carry water on request - ask the security desk.',
  '', 'Issued by the Management Committee.',
]));
out('docs/fire-safety.pdf', pdf('Fire safety circular', [
  '**What to do in case of fire',
  '1. Raise the alarm and call 101. 2. Do not use the lift. 3. Move to the assembly point near the clubhouse. 4. Help elders and children first.',
  '', '**Extinguishers',
  'Extinguishers are placed on every landing and checked every quarter. Please do not block them.',
  '', '**Residents needing assistance',
  'Residents who cannot use stairs are requested to inform the committee so that a volunteer can be assigned to them during a drill.',
]));
out('docs/will-checklist.pdf', pdf('Registered Will - document checklist', [
  '**Documents to keep ready',
  '1. Identity and address proof of the testator. 2. Property documents - sale deed, khata, tax receipts. 3. Bank and investment details. 4. Names, ages and addresses of beneficiaries. 5. Two witnesses with identity proof.',
  '', '**Process',
  'The draft will be prepared after the first consultation, reviewed by the family, and registered at the Sub-Registrar office. Home registration can be arranged for senior citizens.',
]));
out('docs/policy-comparison.pdf', pdf('Senior health insurance - comparison', [
  '**Plans compared for Lakshmi Narayanan (72)',
  'Plan A - Sum insured Rs 5 lakh, pre-existing diseases covered after 2 years, co-pay 20%.',
  'Plan B - Sum insured Rs 10 lakh, pre-existing diseases covered after 1 year, co-pay 10%.',
  'Plan C - Sum insured Rs 10 lakh, no co-pay, higher premium, includes home care.',
  '', '**Recommendation',
  'Plan B balances premium and cover for existing hypertension and diabetes. Please confirm so the proposal can be filed.',
]));

console.log('Demo assets written to public/demo');
