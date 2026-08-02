import type { TranslationKey } from './en';

// Malayalam. AI-translated as part of this feature build — recommend a native
// speaker review before this is trusted for real elders, especially the
// emergency/health strings.
const ml: Record<TranslationKey, string> = {
  'common.loading': 'ലോഡ് ചെയ്യുന്നു…',
  'common.accept': 'സ്വീകരിക്കുക',
  'common.decline': 'നിരസിക്കുക',
  'common.by': 'വഴി',
  'common.myPrescriptions': 'എന്റെ കുറിപ്പടികൾ',

  'elder.home.hello': 'നമസ്കാരം,',
  'elder.home.subtitle': 'നിങ്ങൾക്ക് എന്താണ് വേണ്ടത്?',
  'elder.home.inviteConnectAs': 'നിങ്ങളുമായി ഇങ്ങനെ ബന്ധപ്പെടാൻ ആഗ്രഹിക്കുന്നു:',
  'elder.home.callFamily': 'കുടുംബത്തെ വിളിക്കുക',
  'elder.home.callFamilySub': 'നിങ്ങളുടെ സേവ് ചെയ്ത കോൺടാക്റ്റുകളിലേക്ക് എത്തുക',
  'elder.home.emergencyTitle': 'അടിയന്തരാവസ്ഥ',
  'elder.home.emergencySub': 'ഉടനടി സഹായം ആവശ്യമെങ്കിൽ താഴെയുള്ള ബട്ടൺ അമർത്തുക.',
  'elder.home.sosSending': 'അയക്കുന്നു...',
  'elder.home.needHelpNow': 'ഇപ്പോൾ സഹായം വേണം',
  'elder.home.callAmbulance': 'ആംബുലൻസ് വിളിക്കുക',
  'elder.home.prescriptionsSub': 'നിങ്ങളുടെ ഏറ്റവും പുതിയ കുറിപ്പടികളിലേക്ക് വേഗത്തിലുള്ള പ്രവേശനം.',
  'elder.home.yourProfile': 'നിങ്ങളുടെ പ്രൊഫൈൽ',
  'elder.home.confirmSOS': 'ഇപ്പോൾ തന്നെ നിങ്ങളുടെ കുടുംബത്തിന് അടിയന്തര അലേർട്ട് അയക്കണോ?',
  'elder.home.confirmAmbulance': 'ഇപ്പോൾ ആംബുലൻസ് വിളിക്കണോ? ഇത് {number} എന്ന നമ്പറിലേക്ക് വിളിക്കും.',
  'elder.home.sosSuccess': 'സഹായം എത്തുന്നു. നിങ്ങളുടെ കുടുംബത്തെ അറിയിച്ചിട്ടുണ്ട്.',
  'elder.home.sosErrorGeneric': 'അലേർട്ട് അയക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.',

  'elder.health.title': 'എന്റെ ആരോഗ്യം',
  'elder.health.subtitle': 'നിങ്ങളുടെ മരുന്നുകൾ, അപ്പോയിന്റ്മെന്റുകൾ, പരിചരണ കുറിപ്പുകൾ.',
  'elder.health.todaysMedicines': 'ഇന്നത്തെ മരുന്നുകൾ',
  'elder.health.noMedicinesToday': 'ഇന്നത്തേക്ക് മരുന്നുകളൊന്നും ഷെഡ്യൂൾ ചെയ്തിട്ടില്ല.',
  'elder.health.slot.morning': 'രാവിലെ',
  'elder.health.slot.afternoon': 'ഉച്ചയ്ക്ക്',
  'elder.health.slot.evening': 'വൈകുന്നേരം',
  'elder.health.slot.night': 'രാത്രി',
  'elder.health.medicineWord': 'മരുന്ന്',
  'elder.health.medicinesWord': 'മരുന്നുകൾ',
  'elder.health.byTimePrefix': 'സമയം',
  'elder.health.allConfirmedFor': 'എല്ലാം സ്ഥിരീകരിച്ചു',
  'elder.health.confirming': 'സ്ഥിരീകരിക്കുന്നു…',
  'elder.health.confirmNTaken': '{n} കഴിച്ചത് സ്ഥിരീകരിക്കുക',
  'elder.health.noRemindersGenerated':
    'നിങ്ങൾക്ക് {count} സജീവ {word} ഉണ്ട്, പക്ഷേ ഇന്നത്തേക്ക് ഓർമ്മപ്പെടുത്തലുകളൊന്നും സൃഷ്ടിച്ചിട്ടില്ല. നിങ്ങളുടെ പരിചാരകന് അവ സജ്ജമാക്കാം.',
  'elder.health.confirmErrorGeneric': 'സ്ഥിരീകരിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
  'elder.health.upcomingAppointments': 'വരാനിരിക്കുന്ന അപ്പോയിന്റ്മെന്റുകൾ',
  'elder.health.noUpcomingAppointments': 'വരാനിരിക്കുന്ന അപ്പോയിന്റ്മെന്റുകൾ ഇല്ല.',
  'elder.health.atTimeJoiner': 'സമയം',
  'elder.health.healthNotesTitle': 'ആരോഗ്യ കുറിപ്പുകൾ',
  'elder.health.noHealthNotes': 'ഇതുവരെ ആരോഗ്യ കുറിപ്പുകളൊന്നുമില്ല.',
  'elder.health.mealHelpTitle': 'ഭക്ഷണ സഹായം',
  'elder.health.mealHelpSub': 'ഭക്ഷണത്തിന് സഹായം വേണോ? താഴെ ടാപ്പ് ചെയ്യുക — നിങ്ങളുടെ കുടുംബത്തെ അറിയിക്കും.',
  'elder.health.meal.breakfast': 'പ്രഭാതഭക്ഷണം',
  'elder.health.meal.lunch': 'ഉച്ചഭക്ഷണം',
  'elder.health.meal.dinner': 'അത്താഴം',
  'elder.health.meal.snack': 'ലഘുഭക്ഷണം',
  'elder.health.handledBy': 'കൈകാര്യം ചെയ്തത്',
  'elder.health.noPrescriptions': 'ഇതുവരെ കുറിപ്പടികളൊന്നും അപ്‌ലോഡ് ചെയ്തിട്ടില്ല. നിങ്ങളുടെ പരിചാരകന് അവ അപ്‌ലോഡ് ചെയ്യാം.',
  'elder.health.emergencyContactsTitle': 'അടിയന്തര കോൺടാക്റ്റുകൾ',
};

export default ml;
