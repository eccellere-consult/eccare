// Deliberately dependency-free — imported by both client-side pages that
// compose a WhatsApp message (auto-booking, doctor booking, the emergency
// Police button, the admin invite composer and its own editor) and the
// server-side API routes. Pulled out of lib/whatsapp-templates.ts specifically
// so the client bundle never needs to resolve `@/lib/db` (Prisma), same
// reasoning as lib/voice-shared.ts vs lib/claude.ts.

/** The fixed set of editable WhatsApp message templates — every place in the
 *  app that pre-fills a wa.me message pulls its body from here (via
 *  GET /api/v1/whatsapp-templates) instead of a hardcoded string, so an
 *  admin can edit and save the wording without a code change. Adding a new
 *  templated message elsewhere means adding one entry here and switching
 *  that call site to use it — the key is the only thing that has to match
 *  between here and the consumer. */
export type WhatsAppTemplateKey = 'invite' | 'auto_booking_request' | 'doctor_booking_confirm' | 'emergency_help';

export interface WhatsAppTemplateDef {
  key: WhatsAppTemplateKey;
  label: string;
  /** Explains where this is sent and what {{placeholders}} it supports —
   *  shown to the admin above the editor, since an unrecognized placeholder
   *  left in the saved text just renders literally (see renderTemplate). */
  description: string;
  defaultBody: string;
  /** Built-in translated defaults for the other supported languages — used
   *  until an admin customises that language (stored in
   *  WhatsAppTemplateTranslation). AI-translated; worth a native speaker's
   *  review before relying on them. {{placeholders}} stay in English. */
  translations: Record<'hi' | 'kn' | 'ml', string>;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplateDef[] = [
  {
    key: 'invite',
    label: 'Registration invite',
    description:
      'Sent from Admin → WhatsApp Invite, to invite someone to register on EC. Placeholders: {{name}}, {{link}}, {{community_line}} (a line naming the community + join code, blank if none was picked).',
    defaultBody: [
      'EC — Just Easy. 👵👴',
      '',
      'Hi {{name}},',
      '',
      '✅ One-tap SOS with live location, straight to family',
      '✅ Medicine reminders that actually notify family too',
      '✅ A neighbours directory and community notices',
      '✅ Local shops, services, and doctors in one place',
      '',
      'Register here: {{link}}',
      '{{community_line}}',
    ].join('\n'),
    translations: {
      hi: `EC — Just Easy. 👵👴

नमस्ते {{name}},

✅ एक टैप में SOS, लाइव लोकेशन के साथ सीधे परिवार तक
✅ दवा के रिमाइंडर जो परिवार को भी सूचित करते हैं
✅ पड़ोसियों की डायरेक्टरी और समुदाय की सूचनाएँ
✅ आस-पास की दुकानें, सेवाएँ और डॉक्टर — एक ही जगह

यहाँ रजिस्टर करें: {{link}}
{{community_line}}`,
      kn: `EC — Just Easy. 👵👴

ನಮಸ್ಕಾರ {{name}},

✅ ಒಂದೇ ಟ್ಯಾಪ್‌ನಲ್ಲಿ SOS, ಲೈವ್ ಲೊಕೇಶನ್‌ನೊಂದಿಗೆ ನೇರವಾಗಿ ಕುಟುಂಬಕ್ಕೆ
✅ ಕುಟುಂಬಕ್ಕೂ ತಿಳಿಸುವ ಔಷಧಿ ಜ್ಞಾಪನೆಗಳು
✅ ನೆರೆಹೊರೆಯವರ ಡೈರೆಕ್ಟರಿ ಮತ್ತು ಸಮುದಾಯದ ಸೂಚನೆಗಳು
✅ ಹತ್ತಿರದ ಅಂಗಡಿಗಳು, ಸೇವೆಗಳು ಮತ್ತು ವೈದ್ಯರು — ಒಂದೇ ಸ್ಥಳದಲ್ಲಿ

ಇಲ್ಲಿ ನೋಂದಾಯಿಸಿ: {{link}}
{{community_line}}`,
      ml: `EC — Just Easy. 👵👴

നമസ്കാരം {{name}},

✅ ഒറ്റ ടാപ്പിൽ SOS, ലൈവ് ലൊക്കേഷനോടെ നേരിട്ട് കുടുംബത്തിലേക്ക്
✅ കുടുംബത്തെയും അറിയിക്കുന്ന മരുന്ന് ഓർമ്മപ്പെടുത്തലുകൾ
✅ അയൽക്കാരുടെ ഡയറക്ടറിയും സമൂഹ അറിയിപ്പുകളും
✅ അടുത്തുള്ള കടകൾ, സേവനങ്ങൾ, ഡോക്ടർമാർ — ഒരിടത്ത്

ഇവിടെ രജിസ്റ്റർ ചെയ്യുക: {{link}}
{{community_line}}`,
    },
  },
  {
    key: 'auto_booking_request',
    label: 'Auto booking request',
    description:
      'Sent to a local auto-rickshaw driver when an elder/caregiver requests a trip. Placeholders: {{trip}} (Drop only / Go there & come back), {{pickup}}, {{drop}}, {{date_line}} (blank if no date given), {{rate_line}} (blank if no rate on file).',
    defaultBody: [
      'Hello, I need to book your auto through EC.',
      'Trip: {{trip}}',
      'Pickup: {{pickup}}',
      'Drop: {{drop}}',
      '{{date_line}}',
      '{{rate_line}}',
      'Please reply to confirm you can take this trip. Thank you!',
    ].join('\n'),
    translations: {
      hi: `नमस्ते, मुझे EC के ज़रिए आपका ऑटो बुक करना है।
यात्रा: {{trip}}
पिकअप: {{pickup}}
ड्रॉप: {{drop}}
{{date_line}}
{{rate_line}}
कृपया जवाब देकर पुष्टि करें कि आप यह यात्रा कर सकते हैं। धन्यवाद!`,
      kn: `ನಮಸ್ಕಾರ, EC ಮೂಲಕ ನಿಮ್ಮ ಆಟೋ ಬುಕ್ ಮಾಡಬೇಕು.
ಪ್ರಯಾಣ: {{trip}}
ಪಿಕಪ್: {{pickup}}
ಡ್ರಾಪ್: {{drop}}
{{date_line}}
{{rate_line}}
ಈ ಪ್ರಯಾಣ ಸಾಧ್ಯವೇ ಎಂದು ದಯವಿಟ್ಟು ಉತ್ತರಿಸಿ ದೃಢಪಡಿಸಿ. ಧನ್ಯವಾದಗಳು!`,
      ml: `നമസ്കാരം, EC വഴി നിങ്ങളുടെ ഓട്ടോ ബുക്ക് ചെയ്യണം.
യാത്ര: {{trip}}
പിക്കപ്പ്: {{pickup}}
ഡ്രോപ്പ്: {{drop}}
{{date_line}}
{{rate_line}}
ഈ യാത്ര പറ്റുമെന്ന് മറുപടി നൽകി ഉറപ്പാക്കുക. നന്ദി!`,
    },
  },
  {
    key: 'doctor_booking_confirm',
    label: 'Doctor appointment confirmation',
    description:
      "Sent to the clinic's phone when an elder/caregiver books an appointment slot. Placeholders: {{patient}}, {{time}}, {{fee}}.",
    defaultBody: [
      'Hello, I would like to confirm an appointment booked through EC.',
      'Patient: {{patient}}',
      'Requested time: {{time}}',
      'Consultation fee: ₹{{fee}}',
      'Please call or reply to confirm this slot. Thank you!',
    ].join('\n'),
    translations: {
      hi: `नमस्ते, मैं EC के ज़रिए बुक की गई अपॉइंटमेंट की पुष्टि करना चाहता/चाहती हूँ।
मरीज़: {{patient}}
समय: {{time}}
परामर्श शुल्क: ₹{{fee}}
कृपया कॉल या जवाब देकर यह स्लॉट कन्फ़र्म करें। धन्यवाद!`,
      kn: `ನಮಸ್ಕಾರ, EC ಮೂಲಕ ಬುಕ್ ಮಾಡಿದ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಅನ್ನು ದೃಢೀಕರಿಸಲು ಬಯಸುತ್ತೇನೆ.
ರೋಗಿ: {{patient}}
ಸಮಯ: {{time}}
ಸಮಾಲೋಚನಾ ಶುಲ್ಕ: ₹{{fee}}
ದಯವಿಟ್ಟು ಕರೆ ಮಾಡಿ ಅಥವಾ ಉತ್ತರಿಸಿ ಈ ಸಮಯವನ್ನು ದೃಢಪಡಿಸಿ. ಧನ್ಯವಾದಗಳು!`,
      ml: `നമസ്കാരം, EC വഴി ബുക്ക് ചെയ്ത അപ്പോയിന്റ്മെന്റ് സ്ഥിരീകരിക്കാൻ ആഗ്രഹിക്കുന്നു.
രോഗി: {{patient}}
സമയം: {{time}}
കൺസൾട്ടേഷൻ ഫീസ്: ₹{{fee}}
ദയവായി വിളിച്ചോ മറുപടി നൽകിയോ ഈ സ്ലോട്ട് ഉറപ്പാക്കുക. നന്ദി!`,
    },
  },
  {
    key: 'emergency_help',
    label: 'Emergency "need help" alert',
    description:
      'Sent to the primary emergency contact when the elder taps Call Police. Placeholders: {{location}} (a "My location: <maps link>" line, blank if location was unavailable).',
    defaultBody: 'This is an emergency, I need help.{{location}}',
    translations: {
      hi: `यह आपातकाल है, मुझे मदद चाहिए।{{location}}`,
      kn: `ಇದು ತುರ್ತು ಪರಿಸ್ಥಿತಿ, ನನಗೆ ಸಹಾಯ ಬೇಕು.{{location}}`,
      ml: `ഇത് അടിയന്തര സാഹചര്യമാണ്, എനിക്ക് സഹായം വേണം.{{location}}`,
    },
  },
];

const TEMPLATE_BY_KEY = new Map(WHATSAPP_TEMPLATES.map((t) => [t.key, t]));

export function getTemplateDef(key: WhatsAppTemplateKey): WhatsAppTemplateDef {
  const def = TEMPLATE_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown WhatsApp template key: ${key}`);
  return def;
}

/** Fills {{token}} placeholders from `vars` — an unrecognized token (a typo,
 *  or one left over from a template the admin edited carelessly) is left in
 *  place rather than silently deleted, so a broken template is obviously
 *  broken rather than quietly missing words. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, token) => (token in vars ? vars[token] : match));
}

// ─── Languages ───────────────────────────────────────────────────────────────
// The text of a message is only part of what the recipient reads — pages also
// fill {{placeholders}} with small phrases ("Drop only", "My location: …"), and
// those need to be in the same language or the message reads half-translated.

export type MessageLanguage = 'en' | 'hi' | 'kn' | 'ml';
export const MESSAGE_LANGUAGE_CODES: MessageLanguage[] = ['en', 'hi', 'kn', 'ml'];

export function toMessageLanguage(code: string | null | undefined): MessageLanguage {
  return (MESSAGE_LANGUAGE_CODES as string[]).includes(code ?? '') ? (code as MessageLanguage) : 'en';
}

/** The built-in body for a language: the English default, or its translated
 *  default. (A customised version, if any, is looked up by the server — see
 *  lib/whatsapp-templates.ts.) */
export function getDefaultBody(key: WhatsAppTemplateKey, lang: string): string {
  const def = getTemplateDef(key);
  const code = toMessageLanguage(lang);
  return code === 'en' ? def.defaultBody : def.translations[code];
}

interface Fragments {
  tripDrop: string;
  tripRoundTrip: string;
  dateLine: (date: string, time?: string) => string;
  rateLine: (perKm: number | string, perMinWait: number | string) => string;
  locationLine: (mapsUrl: string) => string;
  communityLine: (name: string, code: string) => string;
  /** A neutral greeting word for when there's no name to fill {{name}} with. */
  genericName: string;
  /** BCP-47 tag for formatting dates/times in this language. */
  locale: string;
}

const FRAGMENTS: Record<MessageLanguage, Fragments> = {
  en: {
    tripDrop: 'Drop only',
    tripRoundTrip: 'Go there & come back',
    dateLine: (d, t) => `Date: ${d}${t ? ` at ${t}` : ''}`,
    rateLine: (km, min) => `Indicative rate: ₹${km}/km, ₹${min}/min waiting.`,
    locationLine: (url) => ` My location: ${url}`,
    communityLine: (name, code) => `Then join our community "${name}" with code: ${code}`,
    genericName: 'there',
    locale: 'en-IN',
  },
  hi: {
    tripDrop: 'सिर्फ़ छोड़ना',
    tripRoundTrip: 'वहाँ जाना और वापस आना',
    dateLine: (d, t) => `तारीख़: ${d}${t ? `, ${t}` : ''}`,
    rateLine: (km, min) => `अनुमानित दर: ₹${km}/किमी, ₹${min}/मिनट प्रतीक्षा।`,
    locationLine: (url) => ` मेरी लोकेशन: ${url}`,
    communityLine: (name, code) => `फिर हमारी कम्युनिटी "${name}" से कोड ${code} के साथ जुड़ें`,
    genericName: 'जी',
    locale: 'hi-IN',
  },
  kn: {
    tripDrop: 'ಬಿಡುವುದು ಮಾತ್ರ',
    tripRoundTrip: 'ಹೋಗಿ ಹಿಂತಿರುಗುವುದು',
    dateLine: (d, t) => `ದಿನಾಂಕ: ${d}${t ? `, ${t}` : ''}`,
    rateLine: (km, min) => `ಅಂದಾಜು ದರ: ₹${km}/ಕಿಮೀ, ₹${min}/ನಿಮಿಷ ಕಾಯುವಿಕೆ.`,
    locationLine: (url) => ` ನನ್ನ ಸ್ಥಳ: ${url}`,
    communityLine: (name, code) => `ನಂತರ ನಮ್ಮ ಸಮುದಾಯ "${name}" ಗೆ ಕೋಡ್ ${code} ನೊಂದಿಗೆ ಸೇರಿ`,
    genericName: 'ಸರ್/ಮೇಡಂ',
    locale: 'kn-IN',
  },
  ml: {
    tripDrop: 'ഇറക്കിവിടൽ മാത്രം',
    tripRoundTrip: 'പോയി തിരികെ വരൽ',
    dateLine: (d, t) => `തീയതി: ${d}${t ? `, ${t}` : ''}`,
    rateLine: (km, min) => `ഏകദേശ നിരക്ക്: ₹${km}/കി.മീ, ₹${min}/മിനിറ്റ് കാത്തിരിപ്പ്.`,
    locationLine: (url) => ` എന്റെ ലൊക്കേഷൻ: ${url}`,
    communityLine: (name, code) => `തുടർന്ന് ഞങ്ങളുടെ കമ്മ്യൂണിറ്റി "${name}" ൽ കോഡ് ${code} ഉപയോഗിച്ച് ചേരൂ`,
    genericName: 'സർ/മാഡം',
    locale: 'ml-IN',
  },
};

export function messageFragments(lang: string): Fragments {
  return FRAGMENTS[toMessageLanguage(lang)];
}

/** One message in several languages: each language's text in turn, separated by
 *  a divider — for audiences that read more than one (e.g. English + the local
 *  language). */
export function combineLanguages(bodies: string[]): string {
  return bodies.join('\n\n────────\n\n');
}
