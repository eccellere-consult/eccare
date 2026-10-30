// The safety layer for health bulletins: pure functions, no database and no network, so every rule can be
// tested on its own. The model is asked to follow these rules in its prompt, but nothing relies on it
// doing so — a bulletin that breaks a "block" rule is rejected automatically, and the disclaimer is
// added by code (never by the model), so it cannot be dropped or reworded.

import { isTrustedUrl, publisherFor } from './health-sources';

export interface BulletinSource {
  title: string;
  url: string;
}

/** What the model returns. The notice and the WhatsApp message are built from these fields in code. */
export interface BulletinFields {
  title: string;
  summary: string;
  tips: string[];
  warningSigns: string[];
  seeDoctor: string;
  sources: BulletinSource[];
}

// A type alias, not an interface, so it can be stored in a Prisma Json column.
export type Flag = {
  level: 'block' | 'warn';
  code: string;
  message: string;
};

export const DISCLAIMER =
  'General health information, not medical advice. Please talk to your own doctor about your health.';

export const hasBlock = (flags: Flag[]) => flags.some((f) => f.level === 'block');

// ── Parsing the model's answer ────────────────────────────────────────────────

/** The first JSON object in a model reply, tolerant of ```json fences and chatter around it. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** Shapes untrusted model output into BulletinFields, or null if the essentials are missing. */
export function parseFields(raw: unknown): BulletinFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const sources = Array.isArray(r.sources)
    ? r.sources
        .map((s) => (s && typeof s === 'object' ? { title: str((s as Record<string, unknown>).title), url: str((s as Record<string, unknown>).url) } : null))
        .filter((s): s is BulletinSource => !!s && !!s.url)
    : [];
  const fields: BulletinFields = {
    title: str(r.title),
    summary: str(r.summary),
    tips: strList(r.tips),
    warningSigns: strList(r.warningSigns),
    seeDoctor: str(r.seeDoctor),
    sources,
  };
  return fields.title && fields.summary && fields.tips.length && fields.seeDoctor && fields.sources.length ? fields : null;
}

/** Makes two spellings of the same page compare equal (case, #fragment, tracking params, trailing slash). */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(key)) u.searchParams.delete(key);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return url.trim();
  }
}

// ── The rules ─────────────────────────────────────────────────────────────────

const MEDICINE_AMOUNT = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|ml|iu|units?|tablets?|capsules?|drops?)\b/i;
const HYPE = /\b(?:miracle|guarantee[sd]?|instant(?:ly)? (?:relief|cure)|reverse[sd]? (?:blindness|glaucoma|diabetes|dementia))\b|\b100\s?%/i;
const CURE = /\bcure[sd]?\b/i;
const NEGATED_CURE = /\b(?:no|not|isn['’]t|is not|cannot|can['’]t|can not|never|without a)\b[^.]{0,25}\bcure[sd]?\b/gi;
const STOP_TREATMENT = /\b(?:stop|skip|quit|avoid|discontinue)\b[^.]{0,40}\b(?:medicines?|medications?|treatment|insulin|tablets?|eye ?drops?|pills?)\b/gi;
const REPLACES_DOCTOR = /\b(?:instead of|rather than|no need (?:to|for)|don['’]t need|do not need)\b[^.]{0,30}\b(?:doctor|physician|specialist|ophthalmologist|check-?ups?|eye tests?|screening)\b/i;
const SCARE = /\b(?:deadly|fatal|terrifying|you will (?:go blind|die))\b/i;
const REFERRAL = /\b(?:doctor|physician|ophthalmologist|specialist|pharmacist|nurse|clinic|hospital|health ?care|eye care|optometrist)\b/i;

/** True when a "stop/skip/avoid ... medicine" phrase is actually telling people not to do that. */
function isSafeStopPhrase(text: string, index: number, length: number): boolean {
  const before = text.slice(Math.max(0, index - 25), index);
  const after = text.slice(index, index + length + 45);
  return (
    /(?:never|do not|don['’]t|dont|should not|shouldn['’]t|must not|not)\s+(?:ever\s+)?$/i.test(before) ||
    /without\s+(?:first\s+)?(?:asking|talking|speaking|checking|consulting)/i.test(after)
  );
}

/** Rules about the words themselves; also re-run on anything an admin edits. */
export function checkText(...texts: string[]): Flag[] {
  const flags: Flag[] = [];
  const all = texts.filter(Boolean).join('\n');

  if (MEDICINE_AMOUNT.test(all)) {
    flags.push({ level: 'block', code: 'medicine-amount', message: 'Mentions an amount of medicine. Bulletins must never give doses.' });
  }
  if (HYPE.test(all)) {
    flags.push({ level: 'block', code: 'hype', message: 'Makes a miracle, guaranteed or reversal claim.' });
  }
  if (CURE.test(all.replace(NEGATED_CURE, ''))) {
    flags.push({ level: 'warn', code: 'cure', message: 'Uses the word "cure" — check it is not promising one.' });
  }
  for (const m of all.matchAll(STOP_TREATMENT)) {
    if (!isSafeStopPhrase(all, m.index ?? 0, m[0].length)) {
      flags.push({ level: 'block', code: 'stop-treatment', message: `Seems to tell people to stop or avoid treatment: "${m[0].slice(0, 70)}".` });
      break;
    }
  }
  if (REPLACES_DOCTOR.test(all)) {
    flags.push({ level: 'block', code: 'replaces-doctor', message: 'Suggests this can replace seeing a doctor.' });
  }
  if (SCARE.test(all)) {
    flags.push({ level: 'warn', code: 'scare', message: 'Contains frightening wording.' });
  }
  if (/https?:\/\//i.test(all)) {
    flags.push({ level: 'warn', code: 'url-in-text', message: 'Has a web address inside the text; links belong in the sources.' });
  }
  return flags;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Every rule, for a freshly written bulletin. `searchedUrls` are the pages the search really returned. */
export function checkFields(fields: BulletinFields, searchedUrls: string[]): Flag[] {
  const flags: Flag[] = [];
  const block = (code: string, message: string) => flags.push({ level: 'block', code, message });
  const warn = (code: string, message: string) => flags.push({ level: 'warn', code, message });

  if (fields.title.length > 100) block('title-long', 'Title is too long.');
  else if (fields.title.length > 70) warn('title-long', 'Title is a little long.');
  if (fields.summary.length > 600) block('summary-long', 'Summary is too long for a notice.');
  else if (fields.summary.length > 380) warn('summary-long', 'Summary is longer than intended.');
  if (fields.tips.length < 2) block('few-tips', 'Needs at least two practical tips.');
  if (fields.tips.length > 6) block('many-tips', 'Too many tips for a notice.');
  if (fields.tips.some((t) => t.length > 180)) warn('tip-long', 'A tip is very long.');
  if (fields.warningSigns.length > 4) warn('many-signs', 'More warning signs than intended.');

  if (!REFERRAL.test(fields.seeDoctor)) block('no-referral', 'Does not tell readers who to see (a doctor, eye specialist, pharmacist…).');

  const sentences = [fields.summary, ...fields.tips].join(' ').split(/[.!?]+/).filter((s) => words(s) > 0);
  const avg = sentences.reduce((n, s) => n + words(s), 0) / Math.max(1, sentences.length);
  const longest = Math.max(0, ...sentences.map(words));
  if (avg > 20) warn('hard-to-read', `Sentences average ${avg.toFixed(0)} words; aim for under 20.`);
  else if (longest > 30) warn('hard-to-read', `One sentence runs to ${longest} words; aim for under 20.`);

  if (fields.sources.length === 0) block('no-sources', 'No sources cited.');
  if (fields.sources.length > 4) warn('many-sources', 'Cites more sources than intended.');
  const seen = new Set(searchedUrls.map(normalizeUrl));
  for (const s of fields.sources) {
    if (!isTrustedUrl(s.url)) block('untrusted-source', `Source is not on the trusted list: ${s.url}`);
    else if (!seen.has(normalizeUrl(s.url))) block('source-not-searched', `Source was not among the pages the search returned: ${s.url}`);
  }

  flags.push(...checkText(fields.title, fields.summary, ...fields.tips, ...fields.warningSigns, fields.seeDoctor));
  return flags;
}

// ── Building the two messages from the fields ─────────────────────────────────

const sourceLine = (s: BulletinSource) => `${publisherFor(s.url)}${s.title ? ` — ${s.title}` : ''}`;

/** The text of a community notice. */
export function composeNotice(f: BulletinFields): string {
  const parts = [f.summary, `What you can do:\n${f.tips.map((t) => `• ${t}`).join('\n')}`];
  if (f.warningSigns.length) parts.push(`Get help quickly if you notice:\n${f.warningSigns.map((t) => `• ${t}`).join('\n')}`);
  parts.push(f.seeDoctor, DISCLAIMER, `Sources:\n${f.sources.map((s) => `${sourceLine(s)}\n${s.url}`).join('\n')}`);
  return parts.join('\n\n');
}

/** A message ready to paste or share into a WhatsApp group (WhatsApp's *bold* and _italic_ markup). */
export function composeWhatsApp(f: BulletinFields): string {
  const parts = [`🩺 *${f.title}*`, f.summary, `✅ *What you can do*\n${f.tips.map((t) => `• ${t}`).join('\n')}`];
  if (f.warningSigns.length) parts.push(`⚠️ *Get help quickly if you notice*\n${f.warningSigns.map((t) => `• ${t}`).join('\n')}`);
  parts.push(`👨‍⚕️ ${f.seeDoctor}`, `_${DISCLAIMER}_`);
  parts.push(`📖 ${f.sources.slice(0, 2).map((s) => `${publisherFor(s.url)}: ${s.url}`).join('\n📖 ')}`);
  parts.push('— EC, Just Easy.');
  return parts.join('\n\n');
}

/** The final gate before anything is published, run on the text as it now stands — so an admin's edits are
 *  held to the same rules, and the disclaimer cannot be edited away. */
export function checkPublishable(title: string, body: string, whatsappText: string): Flag[] {
  const flags = checkText(title, body, whatsappText);
  if (!body.includes(DISCLAIMER)) flags.push({ level: 'block', code: 'disclaimer-missing', message: 'The notice must keep the "not medical advice" line.' });
  if (!whatsappText.includes(DISCLAIMER)) flags.push({ level: 'block', code: 'disclaimer-missing', message: 'The WhatsApp message must keep the "not medical advice" line.' });
  if (!title.trim() || !body.trim()) flags.push({ level: 'block', code: 'empty', message: 'The title and text cannot be empty.' });
  return flags;
}
