// Malayalam strings below are AI-translated, same caveat as the existing i18n
// dictionaries (lib/i18n/dictionaries/ml.ts) — recommend a native speaker review
// before this is trusted for real users.

export interface TourStep {
  /** CSS selector for the element to spotlight — must match a real id already on
   *  the page (register/join-community/family-invite forms all already have
   *  stable ids on every field). */
  selector: string;
  title: { en: string; ml: string };
  body: { en: string; ml: string };
}

export interface Tour {
  id: string;
  steps: TourStep[];
}

/** Three short, focused tours rather than one long cross-page sequence — each
 *  covers what's actually visible and interactive on ONE page, triggered at the
 *  point in a real user's journey where that page is relevant (you can't
 *  meaningfully demo "add an elder" before an account exists to log into).
 *  Register -> Join Community -> Add Elder together cover the full "quick
 *  registration guide ... till the residents association linkage, adding the
 *  elder" ask. English + Malayalam only, per how this was scoped. */
export const TOURS: Record<'register' | 'joinCommunity' | 'addElder', Tour> = {
  register: {
    id: 'register',
    steps: [
      {
        selector: '#reg-name',
        title: { en: 'Your full name', ml: 'നിങ്ങളുടെ പൂർണ്ണ നാമം' },
        body: {
          en: 'Type your name as you\'d like it shown in the app.',
          ml: 'ആപ്പിൽ കാണിക്കേണ്ട രീതിയിൽ നിങ്ങളുടെ പേര് ടൈപ്പ് ചെയ്യുക.',
        },
      },
      {
        selector: '#reg-phone',
        title: { en: 'Phone number — this is how you sign in', ml: 'ഫോൺ നമ്പർ — ഇതാണ് സൈൻ ഇൻ ചെയ്യാനുള്ള വഴി' },
        body: {
          en: 'Your phone number is your main login from now on — no need to remember a username. Family and neighbours can also reach you on it.',
          ml: 'ഇനി മുതൽ നിങ്ങളുടെ പ്രധാന ലോഗിൻ ഇതാണ് — ഒരു യൂസർനെയിം ഓർക്കേണ്ട ആവശ്യമില്ല. കുടുംബാംഗങ്ങൾക്കും അയൽക്കാർക്കും ഇതിലൂടെ നിങ്ങളെ ബന്ധപ്പെടാം.',
        },
      },
      {
        selector: '#reg-email',
        title: { en: 'Email — optional', ml: 'ഇമെയിൽ — നിർബന്ധമല്ല' },
        body: {
          en: "You don't need an email to register. It's only useful if you ever forget your password.",
          ml: 'രജിസ്റ്റർ ചെയ്യാൻ ഇമെയിൽ ആവശ്യമില്ല. പാസ്‌വേഡ് മറന്നുപോയാൽ മാത്രമേ ഇത് ഉപകാരപ്പെടൂ.',
        },
      },
      {
        selector: '#reg-password',
        title: { en: 'Choose a password', ml: 'ഒരു പാസ്‌വേഡ് തിരഞ്ഞെടുക്കുക' },
        body: {
          en: 'At least 8 characters. You\'ll use your phone number and this password together to sign in.',
          ml: 'കുറഞ്ഞത് 8 അക്ഷരങ്ങൾ. സൈൻ ഇൻ ചെയ്യാൻ നിങ്ങളുടെ ഫോൺ നമ്പറും ഈ പാസ്‌വേഡും ഒരുമിച്ച് ഉപയോഗിക്കും.',
        },
      },
    ],
  },
  joinCommunity: {
    id: 'joinCommunity',
    steps: [
      {
        selector: '#joinCode',
        title: { en: "Your community's code", ml: 'നിങ്ങളുടെ കമ്മ്യൂണിറ്റി കോഡ്' },
        body: {
          en: "Ask your residents' association / committee for this short code — it links your account to your community's directory, notices, and helplines.",
          ml: 'ഈ ചെറിയ കോഡിനായി നിങ്ങളുടെ റസിഡന്റ്സ് അസോസിയേഷനോട് / കമ്മിറ്റിയോട് ചോദിക്കുക — ഇത് നിങ്ങളുടെ അക്കൗണ്ടിനെ കമ്മ്യൂണിറ്റിയുടെ ഡയറക്ടറി, അറിയിപ്പുകൾ, ഹെൽപ്‌ലൈനുകൾ എന്നിവയുമായി ബന്ധിപ്പിക്കുന്നു.',
        },
      },
      {
        selector: '#flatNumber',
        title: { en: 'Flat / house number — optional', ml: 'ഫ്ലാറ്റ് / വീട് നമ്പർ — നിർബന്ധമല്ല' },
        body: {
          en: 'Helps neighbours find you in the directory. You can leave this blank and add it later.',
          ml: 'അയൽക്കാർക്ക് ഡയറക്ടറിയിൽ നിങ്ങളെ കണ്ടെത്താൻ ഇത് സഹായിക്കും. ഇത് ഒഴിച്ചിട്ട് പിന്നീട് ചേർക്കാം.',
        },
      },
    ],
  },
  addElder: {
    id: 'addElder',
    steps: [
      {
        selector: '#phone',
        title: { en: "The elder's phone number", ml: 'മുതിർന്ന ആളിന്റെ ഫോൺ നമ്പർ' },
        body: {
          en: "Enter the phone number they'll use to sign in. If they don't have one yet, an email works too — but a phone number is best.",
          ml: 'അവർ സൈൻ ഇൻ ചെയ്യാൻ ഉപയോഗിക്കുന്ന ഫോൺ നമ്പർ നൽകുക. ഇല്ലെങ്കിൽ ഇമെയിലും മതി — എന്നാൽ ഫോൺ നമ്പറാണ് നല്ലത്.',
        },
      },
      {
        selector: '#name',
        title: { en: "The elder's name", ml: 'മുതിർന്ന ആളിന്റെ പേര്' },
        body: { en: 'Their full name, as you\'d like it shown.', ml: 'അവരുടെ പൂർണ്ണ നാമം, കാണിക്കേണ്ട രീതിയിൽ.' },
      },
      {
        selector: '#relationship',
        title: { en: 'Your relationship to them', ml: 'അവരുമായുള്ള നിങ്ങളുടെ ബന്ധം' },
        body: { en: 'e.g. Daughter, Son, Spouse.', ml: 'ഉദാ: മകൾ, മകൻ, ഭർത്താവ്/ഭാര്യ.' },
      },
    ],
  },
};
