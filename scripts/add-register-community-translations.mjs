// One-off: adds the wording for the "choose your community" last step of creating an account.
// Hindi, Kannada and Malayalam are machine-assisted drafts: a native speaker should review them.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'i18n', 'dictionaries');
const ORDER = ['next', 'stepTwo', 'back', 'finish', 'approvalNote'];

const T = {
  en: {
    next: 'Next: choose your community',
    stepTwo: 'Almost done — where do you live?',
    back: 'Back',
    finish: 'Finish and create my account',
    approvalNote: 'Your committee will confirm you. You can start using EC right away.',
  },
  hi: {
    next: 'आगे: अपना समुदाय चुनें',
    stepTwo: 'लगभग हो गया — आप कहाँ रहते हैं?',
    back: 'पीछे',
    finish: 'पूरा करें और मेरा खाता बनाएँ',
    approvalNote: 'आपकी समिति आपको मंज़ूरी देगी। आप EC तुरंत इस्तेमाल करना शुरू कर सकते हैं।',
  },
  kn: {
    next: 'ಮುಂದೆ: ನಿಮ್ಮ ಸಮುದಾಯವನ್ನು ಆರಿಸಿ',
    stepTwo: 'ಬಹುತೇಕ ಮುಗಿಯಿತು — ನೀವು ಎಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ?',
    back: 'ಹಿಂದೆ',
    finish: 'ಮುಗಿಸಿ ಮತ್ತು ನನ್ನ ಖಾತೆ ರಚಿಸಿ',
    approvalNote: 'ನಿಮ್ಮ ಸಮಿತಿ ನಿಮ್ಮನ್ನು ಖಚಿತಪಡಿಸುತ್ತದೆ. ನೀವು ತಕ್ಷಣವೇ EC ಬಳಸಲು ಪ್ರಾರಂಭಿಸಬಹುದು.',
  },
  ml: {
    next: 'അടുത്തത്: നിങ്ങളുടെ കമ്മ്യൂണിറ്റി തിരഞ്ഞെടുക്കുക',
    stepTwo: 'ഏകദേശം കഴിഞ്ഞു — നിങ്ങൾ എവിടെയാണ് താമസിക്കുന്നത്?',
    back: 'പിന്നോട്ട്',
    finish: 'പൂർത്തിയാക്കി എന്റെ അക്കൗണ്ട് സൃഷ്ടിക്കുക',
    approvalNote: 'നിങ്ങളുടെ കമ്മിറ്റി നിങ്ങളെ സ്ഥിരീകരിക്കും. നിങ്ങൾക്ക് ഉടൻ തന്നെ EC ഉപയോഗിച്ചു തുടങ്ങാം.',
  },
};

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

for (const lang of Object.keys(T)) {
  const file = join(dir, `${lang}.ts`);
  let src = readFileSync(file, 'utf8');
  if (src.includes("'login.register.finish'")) {
    console.log(`${lang}: already added`);
    continue;
  }
  const anchor = /^  'login\.register\.createAccount': .*$/m;
  if (!anchor.test(src)) throw new Error(`${lang}: anchor not found`);
  const added = ORDER.map((k) => `  'login.register.${k}': ${q(T[lang][k])},`).join('\n');
  src = src.replace(anchor, (m) => `${m}\n${added}`);
  writeFileSync(file, src);
  console.log(`${lang}: added ${ORDER.length} keys`);
}
