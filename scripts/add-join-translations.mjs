// One-off: adds the "choose your community" wording to the four dictionaries.
// Hindi, Kannada and Malayalam are machine-assisted drafts: a native speaker should review them.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'i18n', 'dictionaries');
const ORDER = ['step1', 'searchPlaceholder', 'memberCount', 'nearYou', 'alreadyIn', 'requestAlready', 'nothingFound', 'haveCode', 'step2', 'houseLabel', 'housePlaceholder', 'houseSavedAs', 'step3', 'saveLocation', 'locationHelp', 'locationFinding', 'locationSaved', 'locationFailed', 'optional', 'joinNamed', 'skipForNow', 'chooseFirst', 'change', 'welcome', 'requestSentNamed'];

const T = {
  en: {
    subtitle: 'Choose where you live, then tell us your house.',
    step1: 'Where do you live?',
    searchPlaceholder: 'Search by community or area',
    memberCount: '{count} neighbours',
    nearYou: 'Near you',
    alreadyIn: 'You are already here',
    requestAlready: 'Request sent',
    nothingFound: 'No community found. Try another name or area.',
    haveCode: 'My community is not listed — I have a code',
    step2: 'Your house',
    houseLabel: 'House number or house name',
    housePlaceholder: 'For example 27 or SREEVALSAM',
    houseSavedAs: 'We will save it as {house}',
    step3: 'Show where your house is',
    saveLocation: 'Save my house location',
    locationHelp: 'Stand at your house and tap the button. Helpers and delivery people can then find you.',
    locationFinding: 'Finding your location…',
    locationSaved: 'Location saved',
    locationFailed: 'We could not find your location. You can skip this and add it later.',
    optional: 'Optional',
    joinNamed: 'Join {name}',
    skipForNow: 'Skip for now',
    chooseFirst: 'Please choose your community first.',
    change: 'Change',
    welcome: 'Welcome! One last step: choose your community.',
    requestSentNamed: 'Your request to join {name} has been sent. A committee member will approve it soon.',
  },
  hi: {
    subtitle: 'चुनें कि आप कहाँ रहते हैं, फिर अपना घर बताएँ।',
    step1: 'आप कहाँ रहते हैं?',
    searchPlaceholder: 'कम्युनिटी या इलाके के नाम से खोजें',
    memberCount: '{count} पड़ोसी',
    nearYou: 'आपके पास',
    alreadyIn: 'आप पहले से यहाँ हैं',
    requestAlready: 'अनुरोध भेजा जा चुका है',
    nothingFound: 'कोई कम्युनिटी नहीं मिली। कोई दूसरा नाम या इलाका आज़माएँ।',
    haveCode: 'मेरी कम्युनिटी सूची में नहीं है — मेरे पास कोड है',
    step2: 'आपका घर',
    houseLabel: 'घर का नंबर या घर का नाम',
    housePlaceholder: 'जैसे 27 या SREEVALSAM',
    houseSavedAs: 'हम इसे {house} के रूप में सहेजेंगे',
    step3: 'अपना घर नक्शे पर दिखाएँ',
    saveLocation: 'मेरे घर की लोकेशन सहेजें',
    locationHelp: 'अपने घर पर खड़े होकर बटन दबाएँ। इससे मददगार और डिलीवरी वाले आपको आसानी से ढूँढ पाएँगे।',
    locationFinding: 'आपकी लोकेशन ढूँढ रहे हैं…',
    locationSaved: 'लोकेशन सहेज ली गई',
    locationFailed: 'हम आपकी लोकेशन नहीं ढूँढ पाए। आप इसे छोड़कर बाद में जोड़ सकते हैं।',
    optional: 'वैकल्पिक',
    joinNamed: '{name} से जुड़ें',
    skipForNow: 'अभी छोड़ें',
    chooseFirst: 'कृपया पहले अपनी कम्युनिटी चुनें।',
    change: 'बदलें',
    welcome: 'स्वागत है! आख़िरी कदम: अपनी कम्युनिटी चुनें।',
    requestSentNamed: '{name} से जुड़ने का आपका अनुरोध भेज दिया गया है। समिति का कोई सदस्य जल्द ही इसे मंज़ूर करेगा।',
  },
  kn: {
    subtitle: 'ನೀವು ಎಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ ಎಂದು ಆರಿಸಿ, ನಂತರ ನಿಮ್ಮ ಮನೆಯನ್ನು ತಿಳಿಸಿ.',
    step1: 'ನೀವು ಎಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ?',
    searchPlaceholder: 'ಕಮ್ಯುನಿಟಿ ಅಥವಾ ಪ್ರದೇಶದ ಹೆಸರಿನಿಂದ ಹುಡುಕಿ',
    memberCount: '{count} ನೆರೆಹೊರೆಯವರು',
    nearYou: 'ನಿಮ್ಮ ಹತ್ತಿರ',
    alreadyIn: 'ನೀವು ಈಗಾಗಲೇ ಇಲ್ಲಿದ್ದೀರಿ',
    requestAlready: 'ವಿನಂತಿ ಕಳುಹಿಸಲಾಗಿದೆ',
    nothingFound: 'ಯಾವುದೇ ಕಮ್ಯುನಿಟಿ ಸಿಗಲಿಲ್ಲ. ಬೇರೆ ಹೆಸರು ಅಥವಾ ಪ್ರದೇಶ ಪ್ರಯತ್ನಿಸಿ.',
    haveCode: 'ನನ್ನ ಕಮ್ಯುನಿಟಿ ಪಟ್ಟಿಯಲ್ಲಿಲ್ಲ — ನನ್ನ ಬಳಿ ಕೋಡ್ ಇದೆ',
    step2: 'ನಿಮ್ಮ ಮನೆ',
    houseLabel: 'ಮನೆ ಸಂಖ್ಯೆ ಅಥವಾ ಮನೆಯ ಹೆಸರು',
    housePlaceholder: 'ಉದಾಹರಣೆ 27 ಅಥವಾ SREEVALSAM',
    houseSavedAs: 'ನಾವು ಇದನ್ನು {house} ಎಂದು ಉಳಿಸುತ್ತೇವೆ',
    step3: 'ನಿಮ್ಮ ಮನೆ ಎಲ್ಲಿದೆ ಎಂದು ತೋರಿಸಿ',
    saveLocation: 'ನನ್ನ ಮನೆಯ ಸ್ಥಳವನ್ನು ಉಳಿಸಿ',
    locationHelp: 'ನಿಮ್ಮ ಮನೆಯ ಬಳಿ ನಿಂತು ಬಟನ್ ಒತ್ತಿ. ಆಗ ಸಹಾಯಕರು ಮತ್ತು ಡೆಲಿವರಿ ಮಾಡುವವರು ನಿಮ್ಮನ್ನು ಹುಡುಕಬಹುದು.',
    locationFinding: 'ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ…',
    locationSaved: 'ಸ್ಥಳ ಉಳಿಸಲಾಗಿದೆ',
    locationFailed: 'ನಿಮ್ಮ ಸ್ಥಳ ಸಿಗಲಿಲ್ಲ. ಇದನ್ನು ಬಿಟ್ಟು ನಂತರ ಸೇರಿಸಬಹುದು.',
    optional: 'ಐಚ್ಛಿಕ',
    joinNamed: '{name} ಗೆ ಸೇರಿ',
    skipForNow: 'ಈಗ ಬಿಟ್ಟುಬಿಡಿ',
    chooseFirst: 'ದಯವಿಟ್ಟು ಮೊದಲು ನಿಮ್ಮ ಕಮ್ಯುನಿಟಿಯನ್ನು ಆರಿಸಿ.',
    change: 'ಬದಲಿಸಿ',
    welcome: 'ಸ್ವಾಗತ! ಕೊನೆಯ ಹೆಜ್ಜೆ: ನಿಮ್ಮ ಕಮ್ಯುನಿಟಿಯನ್ನು ಆರಿಸಿ.',
    requestSentNamed: '{name} ಗೆ ಸೇರುವ ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಲಾಗಿದೆ. ಸಮಿತಿಯ ಸದಸ್ಯರು ಶೀಘ್ರದಲ್ಲೇ ಅದನ್ನು ಅನುಮೋದಿಸುತ್ತಾರೆ.',
  },
  ml: {
    subtitle: 'നിങ്ങൾ എവിടെയാണ് താമസിക്കുന്നതെന്ന് തിരഞ്ഞെടുക്കൂ, പിന്നെ നിങ്ങളുടെ വീട് പറയൂ.',
    step1: 'നിങ്ങൾ എവിടെയാണ് താമസിക്കുന്നത്?',
    searchPlaceholder: 'കമ്മ്യൂണിറ്റിയുടെയോ സ്ഥലത്തിന്റെയോ പേര് തിരയുക',
    memberCount: '{count} അയൽക്കാർ',
    nearYou: 'നിങ്ങളുടെ അടുത്ത്',
    alreadyIn: 'നിങ്ങൾ ഇതിനകം ഇവിടെയുണ്ട്',
    requestAlready: 'അഭ്യർത്ഥന അയച്ചു',
    nothingFound: 'കമ്മ്യൂണിറ്റി ഒന്നും കണ്ടില്ല. മറ്റൊരു പേരോ സ്ഥലമോ നോക്കൂ.',
    haveCode: 'എന്റെ കമ്മ്യൂണിറ്റി പട്ടികയിലില്ല — എന്റെ കയ്യിൽ കോഡ് ഉണ്ട്',
    step2: 'നിങ്ങളുടെ വീട്',
    houseLabel: 'വീട്ടുനമ്പർ അല്ലെങ്കിൽ വീട്ടുപേര്',
    housePlaceholder: 'ഉദാഹരണം 27 അല്ലെങ്കിൽ SREEVALSAM',
    houseSavedAs: 'ഞങ്ങൾ ഇത് {house} എന്ന് സൂക്ഷിക്കും',
    step3: 'നിങ്ങളുടെ വീട് എവിടെയാണെന്ന് കാണിക്കൂ',
    saveLocation: 'എന്റെ വീടിന്റെ ലൊക്കേഷൻ സൂക്ഷിക്കുക',
    locationHelp: 'നിങ്ങളുടെ വീട്ടിൽ നിന്ന് ബട്ടൺ അമർത്തുക. അപ്പോൾ സഹായികൾക്കും ഡെലിവറി ചെയ്യുന്നവർക്കും നിങ്ങളെ കണ്ടെത്താം.',
    locationFinding: 'നിങ്ങളുടെ ലൊക്കേഷൻ കണ്ടെത്തുന്നു…',
    locationSaved: 'ലൊക്കേഷൻ സൂക്ഷിച്ചു',
    locationFailed: 'നിങ്ങളുടെ ലൊക്കേഷൻ കണ്ടെത്താനായില്ല. ഇത് ഒഴിവാക്കി പിന്നീട് ചേർക്കാം.',
    optional: 'ഓപ്ഷണൽ',
    joinNamed: '{name} ൽ ചേരുക',
    skipForNow: 'ഇപ്പോൾ വേണ്ട',
    chooseFirst: 'ദയവായി ആദ്യം നിങ്ങളുടെ കമ്മ്യൂണിറ്റി തിരഞ്ഞെടുക്കൂ.',
    change: 'മാറ്റുക',
    welcome: 'സ്വാഗതം! അവസാന ഘട്ടം: നിങ്ങളുടെ കമ്മ്യൂണിറ്റി തിരഞ്ഞെടുക്കൂ.',
    requestSentNamed: '{name} ൽ ചേരാനുള്ള നിങ്ങളുടെ അഭ്യർത്ഥന അയച്ചിട്ടുണ്ട്. കമ്മിറ്റി അംഗം ഉടൻ അംഗീകരിക്കും.',
  },
};

const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

for (const lang of Object.keys(T)) {
  const file = join(dir, `${lang}.ts`);
  let src = readFileSync(file, 'utf8');
  if (src.includes("'community.join.step1'")) {
    console.log(`${lang}: already has the join wording, skipped`);
    continue;
  }
  // Replace the subtitle line.
  src = src.replace(/^  'community\.join\.subtitle': .*$/m, `  'community.join.subtitle': ${q(T[lang].subtitle)},`);
  // Add the new keys after the last existing join key.
  const anchor = /^  'community\.join\.registerYourCommunity': .*$/m;
  if (!anchor.test(src)) throw new Error(`${lang}: anchor not found`);
  const added = ORDER.map((k) => `  'community.join.${k}': ${q(T[lang][k])},`).join('\n');
  src = src.replace(anchor, (m) => `${m}\n${added}`);
  writeFileSync(file, src);
  console.log(`${lang}: updated`);
}
