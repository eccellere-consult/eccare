import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { localTimeToUtcDate } from '@/lib/medicine-slots';
import type { DemoPeople } from './accounts';
import { at, hoursAgo, hoursFromNow, istDay, minutesAgo, newId, type Tally } from './helpers';

/** The elder's health, safety, family links and daily-life records. */
export async function buildHealth(p: DemoPeople, tally: Tally) {
  const { elderId, familyId, priyaId } = p;

  // ─── Family links ────────────────────────────────────────────────────────
  await prisma.familyRelation.createMany({
    data: [
      { elderUserId: elderId, caregiverUserId: familyId, relationship: 'Son', inviteStatus: 'accepted', canViewHealth: true, canManageMeds: true, receivesSos: true, receivesCheckin: true },
      { elderUserId: elderId, caregiverUserId: priyaId, relationship: 'Daughter', inviteStatus: 'accepted', canViewHealth: true, canManageMeds: false, receivesSos: true, receivesCheckin: true },
    ],
  });
  tally.add('Family links', 2);

  // ─── Emergency contact matrix (primary / secondary / backup) ─────────────
  await prisma.emergencyContact.createMany({
    data: [
      { userId: elderId, name: 'Arjun Narayanan', phone: '9000000002', relationship: 'Son', callOrder: 1, notifyOnSos: true, linkedUserId: familyId, priorityLevel: 'primary' },
      { userId: elderId, name: 'Meera Nair', phone: '9000000101', relationship: 'Neighbour (committee secretary)', callOrder: 2, notifyOnSos: true, linkedUserId: p.neighbour.meera, priorityLevel: 'secondary' },
      { userId: elderId, name: 'Kiran Rao', phone: '9000000105', relationship: 'Community volunteer', callOrder: 3, notifyOnSos: true, linkedUserId: p.neighbour.kiran, priorityLevel: 'backup' },
      { userId: elderId, name: 'Dr. Ramesh Bhat', phone: '9000000301', relationship: 'Family doctor', callOrder: 4, notifyOnSos: false },
    ],
  });
  tally.add('Emergency contacts', 4);

  // ─── Prescriptions and medicines ─────────────────────────────────────────
  const rxBhat = newId();
  const rxCardio = newId();
  await prisma.prescription.createMany({
    data: [
      {
        id: rxBhat, userId: elderId, uploadedById: familyId, fileName: 'Dr Bhat prescription.png', filePath: '/demo/rx/rx-bhat.svg', fileType: 'image/svg+xml',
        doctorName: 'Dr. Ramesh Bhat', hospitalName: 'Indiranagar Clinic', prescriptionDate: at(-32), reviewed: true,
        notes: 'Review after 4 weeks with HbA1c and lipid profile.',
        extractedData: {
          doctorName: 'Dr. Ramesh Bhat', hospitalName: 'Indiranagar Clinic', prescriptionDate: istDay(-32),
          medications: [
            { name: 'Telmisartan', dosage: '40 mg', frequency: 'Once daily', timeSlots: ['08:00'], instructions: 'After breakfast', duration: 'Ongoing', durationDays: null },
            { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily', timeSlots: ['08:30', '20:30'], instructions: 'With food', duration: 'Ongoing', durationDays: null },
            { name: 'Atorvastatin', dosage: '10 mg', frequency: 'Once daily', timeSlots: ['21:30'], instructions: 'At night', duration: 'Ongoing', durationDays: null },
            { name: 'Ecosprin', dosage: '75 mg', frequency: 'Once daily', timeSlots: ['13:30'], instructions: 'After lunch', duration: 'Ongoing', durationDays: null },
          ],
          notes: 'Low salt, low sugar diet. Walk 30 minutes daily.', nextVisitDate: istDay(-4),
        } as Prisma.InputJsonValue,
      },
      {
        id: rxCardio, userId: elderId, uploadedById: familyId, fileName: 'Cardiology OPD.png', filePath: '/demo/rx/rx-cardio.svg', fileType: 'image/svg+xml',
        doctorName: 'Dr. Meenakshi Rao', hospitalName: 'Manipal Hospital', prescriptionDate: at(-58), reviewed: true,
        notes: 'BP 134/82. Echo normal. Review in 3 months.',
        extractedData: {
          doctorName: 'Dr. Meenakshi Rao', hospitalName: 'Manipal Hospital', prescriptionDate: istDay(-58),
          medications: [{ name: 'Amlodipine', dosage: '5 mg', frequency: 'Once daily', timeSlots: ['21:00'], instructions: 'At night', duration: 'Ongoing', durationDays: null }],
          notes: 'Continue present medicines.', nextVisitDate: istDay(3),
        } as Prisma.InputJsonValue,
      },
    ],
  });
  tally.add('Prescriptions', 2);

  const meds = [
    { name: 'Telmisartan', dosage: '40 mg', frequency: 'Once daily', slots: ['08:00'], instructions: 'After breakfast. For blood pressure.', doctor: 'Dr. Ramesh Bhat', rx: rxBhat },
    { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily', slots: ['08:30', '20:30'], instructions: 'With food. For diabetes.', doctor: 'Dr. Ramesh Bhat', rx: rxBhat },
    { name: 'Atorvastatin', dosage: '10 mg', frequency: 'Once daily', slots: ['21:30'], instructions: 'At night. For cholesterol.', doctor: 'Dr. Ramesh Bhat', rx: rxBhat },
    { name: 'Ecosprin', dosage: '75 mg', frequency: 'Once daily', slots: ['13:30'], instructions: 'After lunch.', doctor: 'Dr. Ramesh Bhat', rx: rxBhat },
    { name: 'Calcium + Vitamin D3', dosage: '1 tablet', frequency: 'Once daily', slots: ['13:30'], instructions: 'After lunch, with water.', doctor: 'Dr. Ramesh Bhat', rx: rxBhat },
    { name: 'Amlodipine', dosage: '5 mg', frequency: 'Once daily', slots: ['21:00'], instructions: 'At night.', doctor: 'Dr. Meenakshi Rao', rx: rxCardio },
    { name: 'Timolol eye drops 0.5%', dosage: '1 drop in each eye', frequency: 'Twice daily', slots: ['08:00', '20:00'], instructions: 'Wait 5 minutes between different eye drops.', doctor: 'Dr. Kavita Shenoy', rx: null },
    { name: 'Azithromycin', dosage: '250 mg', frequency: 'Once daily for 5 days', slots: ['09:00'], instructions: 'Finished course for a chest infection.', doctor: 'Dr. Ramesh Bhat', rx: null, past: true },
  ].map((m) => ({ ...m, id: newId() }));

  await prisma.medication.createMany({
    data: meds.map((m) => ({
      id: m.id, userId: elderId, prescriptionId: m.rx, name: m.name, dosage: m.dosage, frequency: m.frequency,
      timeSlots: m.slots as Prisma.InputJsonValue, instructions: m.instructions, prescribingDoctor: m.doctor,
      endDate: m.past ? at(-11, '23:59') : null, isActive: !m.past,
    })),
  });
  tally.add('Medicines', meds.length);

  // A week of pill-box history: mostly taken, a few missed, today partly done.
  const reminders: Prisma.MedicationReminderCreateManyInput[] = [];
  const now = Date.now();
  const missed = new Set(['Metformin|-2|20:30', 'Atorvastatin|-4|21:30', 'Timolol eye drops 0.5%|-1|20:00']);
  const snoozed = new Set(['Calcium + Vitamin D3|0|13:30']);
  meds.forEach((m, idx) => {
    const days = m.past ? [-15, -14, -13, -12, -11] : [-6, -5, -4, -3, -2, -1, 0];
    for (const d of days) {
      for (const slot of m.slots) {
        const scheduledAt = localTimeToUtcDate(istDay(d), slot);
        const key = `${m.name}|${d}|${slot}`;
        let status: 'pending' | 'taken' | 'missed' | 'snoozed' = 'taken';
        let takenAt: Date | null = new Date(scheduledAt.getTime() + (4 + ((idx * 7 + d * 3 + 40) % 18)) * 60_000);
        if (missed.has(key)) { status = 'missed'; takenAt = null; }
        else if (scheduledAt.getTime() > now) { status = 'pending'; takenAt = null; }
        else if (snoozed.has(key) && scheduledAt.getTime() + 3_600_000 > now) { status = 'snoozed'; takenAt = null; }
        reminders.push({ medicationId: m.id, userId: elderId, scheduledAt, status, takenAt });
      }
    }
  });
  await prisma.medicationReminder.createMany({ data: reminders });
  tally.add('Medicine reminders (a week of history)', reminders.length);

  // ─── Appointments ────────────────────────────────────────────────────────
  await prisma.appointment.createMany({
    data: [
      { userId: elderId, doctorName: 'Dr. Meenakshi Rao', specialty: 'Cardiologist', hospital: 'Manipal Hospital, Old Airport Road', datetime: at(3, '11:00'), notes: 'Bring the last ECG and the BP diary. Arjun will accompany.', status: 'upcoming' },
      { userId: elderId, doctorName: 'Dr. Kavita Shenoy', specialty: 'Eye specialist', hospital: 'Lotus Eye Clinic, Indiranagar', datetime: at(12, '16:30'), notes: 'Eye pressure check. Carry the eye drops.', status: 'upcoming' },
      { userId: elderId, doctorName: 'Dr. Arvind Hegde', specialty: 'Diabetologist', hospital: 'Diabetes Care Centre, Indiranagar', datetime: at(20, '09:30'), notes: 'Fasting - no breakfast before the blood test. HbA1c due.', status: 'upcoming' },
      { userId: elderId, doctorName: 'Dr. Ramesh Bhat', specialty: 'General physician', hospital: 'Indiranagar Clinic', datetime: at(-4, '18:00'), notes: 'Four-week review. Medicines continued.', status: 'completed' },
      { userId: elderId, doctorName: 'Dr. Meenakshi Rao', specialty: 'Cardiologist', hospital: 'Manipal Hospital, Old Airport Road', datetime: at(-58, '11:30'), notes: 'Echo normal.', status: 'completed' },
      { userId: elderId, doctorName: 'Dr. Latha Prabhu', specialty: 'Physiotherapist', hospital: 'Home visit', datetime: at(-20, '10:00'), notes: 'Knee exercises. Cancelled - rescheduled by the clinic.', status: 'cancelled' },
    ],
  });
  tally.add('Appointments', 6);

  // ─── Health notes ────────────────────────────────────────────────────────
  await prisma.healthNote.createMany({
    data: [
      { userId: elderId, createdById: familyId, content: 'BP this morning 132/84, pulse 74. Feeling well, had a good breakfast.', createdAt: hoursAgo(20) },
      { userId: elderId, createdById: elderId, content: 'Slept well. Walked twenty minutes in the garden with Sunita aunty.', createdAt: hoursAgo(30) },
      { userId: elderId, createdById: familyId, content: 'Dr. Bhat advised cutting down salt. Started making dal and sambar with less salt.', createdAt: hoursAgo(75) },
      { userId: elderId, createdById: elderId, content: 'Slight knee pain when using the stairs - took the lift instead.', createdAt: hoursAgo(100) },
      { userId: elderId, createdById: familyId, content: 'HbA1c came back at 6.9% - good control. Report saved with the other health papers.', createdAt: hoursAgo(150) },
      { userId: elderId, createdById: elderId, content: 'Eye drops are running low. Told Arjun.', createdAt: hoursAgo(200) },
      { userId: elderId, createdById: familyId, content: 'Fasting sugar 112 mg/dL this morning.', createdAt: hoursAgo(260) },
    ],
  });
  tally.add('Health notes', 7);

  // ─── Coverage and devices ────────────────────────────────────────────────
  await prisma.healthCoverageItem.createMany({
    data: [
      { userId: elderId, addedById: familyId, type: 'hospital_plan', label: 'Senior Health Plan', provider: 'Manipal Hospitals', policyNumber: 'MSH-4471-2290', filePath: '/demo/cards/health-plan.svg', fileName: 'health-plan-card.png', fileType: 'image/svg+xml', notes: 'Cashless at all Manipal hospitals. Helpline 080 4000 1111.' },
      { userId: elderId, addedById: familyId, type: 'insurance_plan', label: 'Senior Red Carpet policy', provider: 'Star Health', policyNumber: 'P/211111/01/2026/003481', filePath: '/demo/cards/insurance.svg', fileName: 'policy-card.png', fileType: 'image/svg+xml', notes: 'Sum insured Rs 10 lakh. Renews every August.' },
      { userId: elderId, addedById: familyId, type: 'diagnostics', label: 'Annual full-body check-up', provider: 'Thyrocare', policyNumber: 'TC-882913', notes: 'Home sample collection included. Next one due in December.' },
      { userId: elderId, addedById: elderId, type: 'wearable_gadget', label: 'Smartwatch with fall detection', provider: 'Noise', policyNumber: 'Serial NZ-30912', notes: 'Paired with Arjun’s phone. Charge every second night.' },
      { userId: elderId, addedById: familyId, type: 'wearable_gadget', label: 'Digital BP monitor', provider: 'Omron', policyNumber: 'HEM-7120', notes: 'Kept on the bedside table. Readings noted in the health notes.' },
    ],
  });
  tally.add('Health coverage and devices', 5);

  // ─── Wellness: mood, media, reminders, meals, voice ──────────────────────
  const moods = ['good', 'great', 'good', 'okay', 'good', 'great', 'okay', 'low', 'okay', 'good', 'good', 'great', 'good', 'good'] as const;
  await prisma.moodLog.createMany({
    data: moods.map((mood, i) => {
      const dayOffset = i - (moods.length - 1);
      return { userId: elderId, mood, createdAt: dayOffset === 0 ? minutesAgo(25) : at(dayOffset, '09:10') };
    }),
  });
  tally.add('Mood check-ins (two weeks)', moods.length);

  await prisma.familyMediaLink.createMany({
    data: [
      { userId: elderId, addedById: familyId, title: 'Morning bhajans', url: 'https://www.youtube.com/results?search_query=morning+bhajans+playlist', mediaType: 'music', description: 'Amma’s favourite way to start the day.' },
      { userId: elderId, addedById: priyaId, title: 'Carnatic classics', url: 'https://www.youtube.com/results?search_query=carnatic+vocal+classics', mediaType: 'music', description: 'Sent by Priya from Singapore.' },
      { userId: elderId, addedById: familyId, title: 'Chair yoga for seniors', url: 'https://www.youtube.com/results?search_query=chair+yoga+for+seniors', mediaType: 'video', description: 'Ten gentle minutes after breakfast.' },
      { userId: elderId, addedById: familyId, title: 'Pranayama for beginners', url: 'https://www.youtube.com/results?search_query=pranayama+for+beginners', mediaType: 'video', description: 'Breathing exercises recommended by Dr. Bhat.' },
    ],
  });
  tally.add('Music and video links', 4);

  await prisma.reminder.createMany({
    data: [
      { userId: elderId, message: 'Call Dr. Bhat’s clinic to confirm Thursday', remindAt: hoursFromNow(2), notified: false },
      { userId: elderId, message: 'Water the tulsi plant', remindAt: at(1, '07:30'), notified: false },
      { userId: elderId, message: 'Call Priya - it is her birthday', remindAt: at(5, '09:00'), notified: false },
      { userId: elderId, message: 'Take the BP reading before breakfast', remindAt: hoursAgo(26), notified: true },
    ],
  });
  tally.add('Voice reminders', 4);

  await prisma.foodRequest.createMany({
    data: [
      { userId: elderId, requestType: 'lunch', notes: 'Something light - khichdi if possible.', status: 'requested', createdAt: minutesAgo(40) },
      { userId: elderId, requestType: 'dinner', notes: 'Chapati and sabzi, less salt.', status: 'fulfilled', handledBy: familyId, createdAt: hoursAgo(28) },
      { userId: elderId, requestType: 'breakfast', notes: 'Idli and sambar.', status: 'fulfilled', handledBy: familyId, createdAt: hoursAgo(52) },
      { userId: elderId, requestType: 'snack', notes: null, status: 'cancelled', handledBy: elderId, createdAt: hoursAgo(80) },
    ],
  });
  tally.add('Meal requests', 4);

  await prisma.voiceLog.createMany({
    data: [
      { userId: elderId, transcript: 'Call my son', intent: 'call_contact', responseText: 'Calling Arjun now.', actionTaken: 'call_contact', createdAt: hoursAgo(5) },
      { userId: elderId, transcript: 'What medicines do I take now?', intent: 'show_medicines', responseText: 'Here are your medicines for today.', actionTaken: 'show_medicines', createdAt: hoursAgo(9) },
      { userId: elderId, transcript: 'Remind me to call the plumber at five', intent: 'set_reminder', responseText: 'I will remind you to call the plumber at 5 PM.', actionTaken: 'set_reminder', createdAt: hoursAgo(24) },
      { userId: elderId, transcript: 'Tell Arjun I am not feeling very hungry today', intent: 'send_family_message', responseText: 'I have let Arjun know.', actionTaken: 'send_family_message', createdAt: hoursAgo(30) },
      { userId: elderId, transcript: 'I want lunch', intent: 'order_food', responseText: 'I have told your family you would like lunch.', actionTaken: 'order_food', createdAt: hoursAgo(31) },
      { userId: elderId, transcript: 'Do I have any appointments?', intent: 'show_appointments', responseText: 'You see Dr. Meenakshi Rao in three days at 11 AM.', actionTaken: 'show_appointments', createdAt: hoursAgo(50) },
      { userId: elderId, transcript: 'Book me with Dr. Bhat tomorrow at four', intent: 'book_appointment', responseText: 'Should I book Dr. Bhat tomorrow at 4 PM?', actionTaken: 'none', createdAt: hoursAgo(72) },
      { userId: elderId, transcript: 'Order masala dosa', intent: 'order_online', responseText: 'Should I open Swiggy and search for masala dosa?', actionTaken: 'none', createdAt: hoursAgo(96) },
    ],
  });
  tally.add('Voice assistant history', 8);

  // ─── Past emergencies (all resolved) ─────────────────────────────────────
  await prisma.sOSEvent.createMany({
    data: [
      { userId: elderId, triggerType: 'manual', lat: 12.9784, lng: 77.6408, address: 'A-204, Sunrise Residency, Indiranagar', status: 'resolved', acknowledgedBy: familyId, createdAt: at(-40, '07:42'), resolvedAt: at(-40, '07:55') },
      { userId: elderId, triggerType: 'ambulance', lat: 12.9784, lng: 77.6408, address: 'A-204, Sunrise Residency, Indiranagar', status: 'resolved', acknowledgedBy: familyId, createdAt: at(-21, '22:15'), resolvedAt: at(-21, '23:30') },
    ],
  });
  tally.add('Emergency alerts (past, resolved)', 2);

  // ─── Contacts book ───────────────────────────────────────────────────────
  await prisma.contact.createMany({
    data: [
      { elderUserId: elderId, addedById: familyId, name: 'Meera Nair', phone: '9000000101', category: 'neighbor', notes: 'Committee secretary, C-301.', shareWithNeighbours: true },
      { elderUserId: elderId, addedById: elderId, name: 'George Mathew', phone: '9000000107', category: 'neighbor', notes: 'Plays chess in the evenings.', shareWithNeighbours: true },
      { elderUserId: elderId, addedById: elderId, name: 'Sunita Deshmukh', phone: '9000000104', category: 'friend', notes: 'Morning walk partner.' },
      { elderUserId: elderId, addedById: elderId, name: 'Vasudevan (cousin)', phone: '9000000401', category: 'friend', notes: 'Lives in Mysuru.' },
      { elderUserId: elderId, addedById: familyId, name: 'Ravi Kumar', phone: '9000000202', category: 'serviceProvider', providerType: 'Auto driver', notes: 'Takes Amma to the hospital.' },
      { elderUserId: elderId, addedById: familyId, name: 'Shankar', phone: '9000000402', category: 'serviceProvider', providerType: 'Plumber' },
      { elderUserId: elderId, addedById: familyId, name: 'Vijay', phone: '9000000403', category: 'serviceProvider', providerType: 'Electrician' },
      { elderUserId: elderId, addedById: familyId, name: 'Manipal Hospital', phone: '08022221111', category: 'hospital', notes: 'Emergency desk open 24 hours.' },
      { elderUserId: elderId, addedById: elderId, name: 'Kamala (house help)', phone: '9000000404', category: 'other', notes: 'Comes at 7:30 AM.' },
    ],
  });
  tally.add('Contacts', 9);

  // ─── Memories ────────────────────────────────────────────────────────────
  await prisma.memory.createMany({
    data: [
      { elderUserId: elderId, addedById: familyId, imagePath: '/demo/memories/diwali.svg', caption: 'Diwali evening - lighting the diyas together.', createdAt: at(-330, '19:30') },
      { elderUserId: elderId, addedById: priyaId, imagePath: '/demo/memories/grandkids.svg', caption: 'The grandchildren’s visit in the summer holidays.', createdAt: at(-150, '17:00') },
      { elderUserId: elderId, addedById: elderId, imagePath: '/demo/memories/lalbagh.svg', caption: 'Morning walk at Lalbagh with Sunita.', createdAt: at(-60, '07:30') },
      { elderUserId: elderId, addedById: familyId, imagePath: '/demo/memories/anniversary.svg', caption: 'Anniversary lunch - thirty-eight years.', createdAt: at(-45, '13:30') },
      { elderUserId: elderId, addedById: familyId, imagePath: '/demo/memories/temple.svg', caption: 'Our trip to Mysuru.', createdAt: at(-25, '11:00') },
      { elderUserId: elderId, addedById: priyaId, imagePath: '/demo/memories/birthday.svg', caption: 'Amma’s 72nd birthday cake, sent from Singapore with love.', createdAt: at(-208, '20:00') },
    ],
  });
  tally.add('Family memories (photos)', 6);

  // ─── Bills ───────────────────────────────────────────────────────────────
  const billers = [
    { id: newId(), billerType: 'electricity' as const, billerName: 'BESCOM', consumerNumber: 'RR-1048823', nickname: 'Home electricity', autopayEnabled: true },
    { id: newId(), billerType: 'water' as const, billerName: 'BWSSB', consumerNumber: 'CAN-33129001', nickname: 'Water', autopayEnabled: false },
    { id: newId(), billerType: 'mobile' as const, billerName: 'Airtel', consumerNumber: '9000000001', nickname: 'Amma’s mobile', autopayEnabled: false },
    { id: newId(), billerType: 'insurance' as const, billerName: 'LIC of India', consumerNumber: '778120412', nickname: 'LIC premium', autopayEnabled: false },
    { id: newId(), billerType: 'property_tax' as const, billerName: 'BBMP', consumerNumber: 'PID-102-4489', nickname: 'Property tax', autopayEnabled: false },
    { id: newId(), billerType: 'cable_tv' as const, billerName: 'Tata Play', consumerNumber: '1209933811', nickname: 'TV', autopayEnabled: false },
  ];
  await prisma.linkedBiller.createMany({ data: billers.map((b) => ({ ...b, elderUserId: elderId, addedById: familyId })) });
  const [elec, water, mobile, lic, tax, tv] = billers;
  const paid = (billerId: string, amount: number, daysAgo: number) => ({
    linkedBillerId: billerId, amount, status: 'paid' as const, dueDate: at(-daysAgo + 3), paidAt: at(-daysAgo), razorpayPaymentId: `pay_demo_${newId().slice(0, 12)}`,
  });
  await prisma.billPayment.createMany({
    data: [
      { linkedBillerId: elec.id, amount: 1846, status: 'due', dueDate: at(6) },
      paid(elec.id, 1712, 26),
      paid(elec.id, 1590, 56),
      { linkedBillerId: water.id, amount: 428, status: 'due', dueDate: at(11) },
      paid(water.id, 396, 34),
      { linkedBillerId: mobile.id, amount: 399, status: 'due', dueDate: at(3) },
      paid(mobile.id, 399, 28),
      { linkedBillerId: lic.id, amount: 6200, status: 'due', dueDate: at(40) },
      paid(tax.id, 14300, 190),
      { linkedBillerId: tv.id, amount: 320, status: 'due', dueDate: at(9) },
      paid(tv.id, 320, 31),
    ],
  });
  tally.add('Linked bills and payments', billers.length + 11);

  return { rxBhat, medications: meds };
}
