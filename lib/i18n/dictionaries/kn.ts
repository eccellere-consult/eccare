import type { TranslationKey } from './en';

// Kannada. AI-translated as part of this feature build — recommend a native
// speaker review before this is trusted for real elders, especially the
// emergency/health strings.
const kn: Record<TranslationKey, string> = {
  'common.loading': 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
  'common.accept': 'ಸ್ವೀಕರಿಸಿ',
  'common.decline': 'ನಿರಾಕರಿಸಿ',
  'common.by': 'ಮೂಲಕ',
  'common.myPrescriptions': 'ನನ್ನ ಔಷಧಿ ಚೀಟಿಗಳು',

  'elder.home.hello': 'ನಮಸ್ಕಾರ,',
  'elder.home.subtitle': 'ನಿಮಗೆ ಏನು ಬೇಕು?',
  'elder.home.inviteConnectAs': 'ನಿಮ್ಮೊಂದಿಗೆ ಈ ರೀತಿ ಸಂಪರ್ಕ ಸಾಧಿಸಲು ಬಯಸುತ್ತಾರೆ:',
  'elder.home.callFamily': 'ಕುಟುಂಬಕ್ಕೆ ಕರೆ ಮಾಡಿ',
  'elder.home.callFamilySub': 'ನಿಮ್ಮ ಉಳಿಸಿದ ಸಂಪರ್ಕಗಳನ್ನು ತಲುಪಿ',
  'elder.home.emergencyTitle': 'ತುರ್ತು',
  'elder.home.emergencySub': 'ನಿಮಗೆ ತಕ್ಷಣ ಸಹಾಯ ಬೇಕಿದ್ದರೆ ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿ.',
  'elder.home.sosSending': 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...',
  'elder.home.needHelpNow': 'ಈಗ ಸಹಾಯ ಬೇಕು',
  'elder.home.callAmbulance': 'ಆಂಬ್ಯುಲೆನ್ಸ್ ಕರೆ ಮಾಡಿ',
  'elder.home.prescriptionsSub': 'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಔಷಧಿ ಚೀಟಿಗಳಿಗೆ ತ್ವರಿತ ಪ್ರವೇಶ.',
  'elder.home.yourProfile': 'ನಿಮ್ಮ ಪ್ರೊಫೈಲ್',
  'elder.home.confirmSOS': 'ಈಗಲೇ ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ತುರ್ತು ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಬೇಕೇ?',
  'elder.home.confirmAmbulance': 'ಈಗ ಆಂಬ್ಯುಲೆನ್ಸ್ ಕರೆ ಮಾಡಬೇಕೇ? ಇದು {number} ಗೆ ಕರೆ ಮಾಡುತ್ತದೆ.',
  'elder.home.sosSuccess': 'ಸಹಾಯ ಬರುತ್ತಿದೆ. ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ತಿಳಿಸಲಾಗಿದೆ.',
  'elder.home.sosErrorGeneric': 'ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',

  'elder.health.title': 'ನನ್ನ ಆರೋಗ್ಯ',
  'elder.health.subtitle': 'ನಿಮ್ಮ ಔಷಧಿಗಳು, ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು ಮತ್ತು ಆರೈಕೆ ಟಿಪ್ಪಣಿಗಳು.',
  'elder.health.todaysMedicines': 'ಇಂದಿನ ಔಷಧಿಗಳು',
  'elder.health.noMedicinesToday': 'ಇಂದಿಗೆ ಯಾವುದೇ ಔಷಧಿ ನಿಗದಿಯಾಗಿಲ್ಲ.',
  'elder.health.slot.morning': 'ಬೆಳಿಗ್ಗೆ',
  'elder.health.slot.afternoon': 'ಮಧ್ಯಾಹ್ನ',
  'elder.health.slot.evening': 'ಸಂಜೆ',
  'elder.health.slot.night': 'ರಾತ್ರಿ',
  'elder.health.medicineWord': 'ಔಷಧಿ',
  'elder.health.medicinesWord': 'ಔಷಧಿಗಳು',
  'elder.health.byTimePrefix': 'ಸಮಯ',
  'elder.health.allConfirmedFor': 'ಎಲ್ಲವೂ ಖಚಿತಪಡಿಸಲಾಗಿದೆ',
  'elder.health.confirming': 'ಖಚಿತಪಡಿಸಲಾಗುತ್ತಿದೆ…',
  'elder.health.confirmNTaken': '{n} ತೆಗೆದುಕೊಂಡಿದ್ದನ್ನು ಖಚಿತಪಡಿಸಿ',
  'elder.health.noRemindersGenerated':
    'ನಿಮ್ಮಲ್ಲಿ {count} ಸಕ್ರಿಯ {word} ಇವೆ, ಆದರೆ ಇಂದಿಗೆ ಯಾವುದೇ ಜ್ಞಾಪನೆಗಳನ್ನು ರಚಿಸಲಾಗಿಲ್ಲ. ನಿಮ್ಮ ಆರೈಕೆದಾರರು ಅವುಗಳನ್ನು ಹೊಂದಿಸಬಹುದು.',
  'elder.health.confirmErrorGeneric': 'ಖಚಿತಪಡಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  'elder.health.upcomingAppointments': 'ಮುಂಬರುವ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು',
  'elder.health.noUpcomingAppointments': 'ಯಾವುದೇ ಮುಂಬರುವ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳಿಲ್ಲ.',
  'elder.health.atTimeJoiner': 'ಸಮಯ',
  'elder.health.healthNotesTitle': 'ಆರೋಗ್ಯ ಟಿಪ್ಪಣಿಗಳು',
  'elder.health.noHealthNotes': 'ಇನ್ನೂ ಯಾವುದೇ ಆರೋಗ್ಯ ಟಿಪ್ಪಣಿಗಳಿಲ್ಲ.',
  'elder.health.mealHelpTitle': 'ಊಟದ ಸಹಾಯ',
  'elder.health.mealHelpSub': 'ಊಟಕ್ಕೆ ಸಹಾಯ ಬೇಕೇ? ಕೆಳಗೆ ಟ್ಯಾಪ್ ಮಾಡಿ — ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕೆ ತಿಳಿಸಲಾಗುತ್ತದೆ.',
  'elder.health.meal.breakfast': 'ಬೆಳಗಿನ ಉಪಾಹಾರ',
  'elder.health.meal.lunch': 'ಮಧ್ಯಾಹ್ನದ ಊಟ',
  'elder.health.meal.dinner': 'ರಾತ್ರಿಯ ಊಟ',
  'elder.health.meal.snack': 'ಲಘು ಆಹಾರ',
  'elder.health.handledBy': 'ನಿರ್ವಹಿಸಿದವರು',
  'elder.health.noPrescriptions': 'ಇನ್ನೂ ಯಾವುದೇ ಔಷಧಿ ಚೀಟಿಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿಲ್ಲ. ನಿಮ್ಮ ಆರೈಕೆದಾರರು ಅವುಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಬಹುದು.',
  'elder.health.emergencyContactsTitle': 'ತುರ್ತು ಸಂಪರ್ಕಗಳು',
};

export default kn;
