import type { TranslationKey } from './en';

// Hindi. AI-translated as part of this feature build — recommend a native
// speaker review before this is trusted for real elders, especially the
// emergency/health strings.
const hi: Record<TranslationKey, string> = {
  'common.loading': 'लोड हो रहा है…',
  'common.accept': 'स्वीकार करें',
  'common.decline': 'अस्वीकार करें',
  'common.by': 'द्वारा',
  'common.myPrescriptions': 'मेरे नुस्खे',

  'elder.home.hello': 'नमस्ते,',
  'elder.home.subtitle': 'आपको क्या चाहिए?',
  'elder.home.inviteConnectAs': 'आपसे इस रूप में जुड़ना चाहते हैं:',
  'elder.home.callFamily': 'परिवार को कॉल करें',
  'elder.home.callFamilySub': 'अपने सहेजे गए संपर्कों तक पहुंचें',
  'elder.home.emergencyTitle': 'आपातकाल',
  'elder.home.emergencySub': 'यदि आपको तुरंत मदद चाहिए तो नीचे दिया गया बटन दबाएं।',
  'elder.home.sosSending': 'भेजा जा रहा है...',
  'elder.home.needHelpNow': 'अभी मदद चाहिए',
  'elder.home.callAmbulance': 'एम्बुलेंस बुलाएं',
  'elder.home.prescriptionsSub': 'अपने नवीनतम नुस्खों तक त्वरित पहुंच।',
  'elder.home.yourProfile': 'आपकी प्रोफ़ाइल',
  'elder.home.confirmSOS': 'क्या अभी अपने परिवार को आपातकालीन अलर्ट भेजना है?',
  'elder.home.confirmAmbulance': 'अभी एम्बुलेंस बुलाएं? यह {number} पर कॉल करेगा।',
  'elder.home.sosSuccess': 'मदद आ रही है। आपके परिवार को सूचित कर दिया गया है।',
  'elder.home.sosErrorGeneric': 'अलर्ट नहीं भेजा जा सका। कृपया फिर से प्रयास करें।',

  'elder.health.title': 'मेरा स्वास्थ्य',
  'elder.health.subtitle': 'आपकी दवाएं, अपॉइंटमेंट और देखभाल नोट्स।',
  'elder.health.todaysMedicines': 'आज की दवाएं',
  'elder.health.noMedicinesToday': 'आज के लिए कोई दवा निर्धारित नहीं है।',
  'elder.health.slot.morning': 'सुबह',
  'elder.health.slot.afternoon': 'दोपहर',
  'elder.health.slot.evening': 'शाम',
  'elder.health.slot.night': 'रात',
  'elder.health.medicineWord': 'दवा',
  'elder.health.medicinesWord': 'दवाएं',
  'elder.health.byTimePrefix': 'समय तक',
  'elder.health.allConfirmedFor': 'के लिए सभी की पुष्टि हो गई',
  'elder.health.confirming': 'पुष्टि हो रही है…',
  'elder.health.confirmNTaken': '{n} ली गई पुष्टि करें',
  'elder.health.noRemindersGenerated':
    'आपके पास {count} सक्रिय {word} हैं, लेकिन आज के लिए कोई रिमाइंडर नहीं बनाया गया। आपका देखभालकर्ता उन्हें सेट कर सकता है।',
  'elder.health.confirmErrorGeneric': 'पुष्टि नहीं हो सकी। कृपया फिर से प्रयास करें।',
  'elder.health.upcomingAppointments': 'आगामी अपॉइंटमेंट',
  'elder.health.noUpcomingAppointments': 'कोई आगामी अपॉइंटमेंट नहीं है।',
  'elder.health.atTimeJoiner': 'को',
  'elder.health.healthNotesTitle': 'स्वास्थ्य नोट्स',
  'elder.health.noHealthNotes': 'अभी तक कोई स्वास्थ्य नोट्स नहीं हैं।',
  'elder.health.mealHelpTitle': 'भोजन सहायता',
  'elder.health.mealHelpSub': 'भोजन में मदद चाहिए? नीचे टैप करें — आपके परिवार को सूचित किया जाएगा।',
  'elder.health.meal.breakfast': 'नाश्ता',
  'elder.health.meal.lunch': 'दोपहर का भोजन',
  'elder.health.meal.dinner': 'रात का खाना',
  'elder.health.meal.snack': 'स्नैक',
  'elder.health.handledBy': 'द्वारा संभाला गया',
  'elder.health.noPrescriptions': 'अभी तक कोई नुस्खे अपलोड नहीं किए गए हैं। आपका देखभालकर्ता उन्हें अपलोड कर सकता है।',
  'elder.health.emergencyContactsTitle': 'आपातकालीन संपर्क',
};

export default hi;
