// English is the source of truth for every key — every other dictionary
// (lib/i18n/dictionaries/hi.ts, kn.ts, ml.ts) must cover the same key set.
// {placeholder} tokens are replaced with plain string substitution in the
// callers, not a templating engine — see lib/i18n/dictionary.ts.
const en = {
  'common.loading': 'Loading…',
  'common.accept': 'Accept',
  'common.decline': 'Decline',
  'common.by': 'By',
  'common.myPrescriptions': 'My prescriptions',

  'elder.home.hello': 'Hello,',
  'elder.home.subtitle': 'What do you need?',
  'elder.home.inviteConnectAs': 'wants to connect as your',
  'elder.home.callFamily': 'Call Family',
  'elder.home.callFamilySub': 'Reach your saved contacts',
  'elder.home.emergencyTitle': 'Emergency',
  'elder.home.emergencySub': 'Press the button below if you need help right away.',
  'elder.home.sosSending': 'Sending...',
  'elder.home.needHelpNow': 'Need Help Now',
  'elder.home.callAmbulance': 'Call Ambulance',
  'elder.home.prescriptionsSub': 'Quick access to your latest prescriptions.',
  'elder.home.yourProfile': 'Your Profile',
  'elder.home.confirmSOS': 'Send an emergency alert to your family right now?',
  'elder.home.confirmAmbulance': 'Call ambulance now? This will dial {number}.',
  'elder.home.sosSuccess': 'Help is coming. Your family has been notified.',
  'elder.home.sosErrorGeneric': 'Could not send alert. Please try again.',

  'elder.health.title': 'My health',
  'elder.health.subtitle': 'Your medications, appointments, and care notes.',
  'elder.health.todaysMedicines': "Today's medicines",
  'elder.health.noMedicinesToday': 'No medicines scheduled for today.',
  'elder.health.slot.morning': 'Morning',
  'elder.health.slot.afternoon': 'Afternoon',
  'elder.health.slot.evening': 'Evening',
  'elder.health.slot.night': 'Night',
  'elder.health.medicineWord': 'medicine',
  'elder.health.medicinesWord': 'medicines',
  'elder.health.byTimePrefix': 'By',
  'elder.health.allConfirmedFor': 'All confirmed for',
  'elder.health.confirming': 'Confirming…',
  'elder.health.confirmNTaken': 'Confirm {n} taken',
  'elder.health.noRemindersGenerated':
    'You have {count} active {word}, but no reminders were generated for today. Your caregiver can set those up.',
  'elder.health.confirmErrorGeneric': 'Could not confirm. Please try again.',
  'elder.health.upcomingAppointments': 'Upcoming appointments',
  'elder.health.noUpcomingAppointments': 'No upcoming appointments.',
  'elder.health.atTimeJoiner': 'at',
  'elder.health.healthNotesTitle': 'Health notes',
  'elder.health.noHealthNotes': 'No health notes yet.',
  'elder.health.mealHelpTitle': 'Meal help',
  'elder.health.mealHelpSub': 'Need help with a meal? Tap below — your family will be notified.',
  'elder.health.meal.breakfast': 'Breakfast',
  'elder.health.meal.lunch': 'Lunch',
  'elder.health.meal.dinner': 'Dinner',
  'elder.health.meal.snack': 'Snack',
  'elder.health.handledBy': 'handled by',
  'elder.health.noPrescriptions': 'No prescriptions uploaded yet. Your caregiver can upload them.',
  'elder.health.emergencyContactsTitle': 'Emergency contacts',
};

export default en;
export type TranslationKey = keyof typeof en;
