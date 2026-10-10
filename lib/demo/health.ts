import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { localTimeToUtcDate } from '@/lib/medicine-slots';
import type { DemoPeople } from './accounts';
import { addressOf, at, DEMO_LAT, DEMO_LNG, hoursAgo, hoursFromNow, istDay, makeRng, minutesAgo, newId, type Tally } from './helpers';
import { ELDER, FAMILY, NEIGHBOURS } from './cast';

const DAYS = 90;

/** The elder's health, safety, family links and daily-life records — ninety days of them. */
export async function buildHealth(p: DemoPeople, tally: Tally) {
  const { elderId, familyId, sisterId } = p;
  const rng = makeRng(101);
  const home = addressOf(ELDER.house);

  // ─── Family links ────────────────────────────────────────────────────────
  await prisma.familyRelation.createMany({
    data: [
      { elderUserId: elderId, caregiverUserId: familyId, relationship: 'Son', inviteStatus: 'accepted', canViewHealth: true, canManageMeds: true, receivesSos: true, receivesCheckin: true, createdAt: at(-100) },
      { elderUserId: elderId, caregiverUserId: sisterId, relationship: 'Daughter', inviteStatus: 'accepted', canViewHealth: true, canManageMeds: false, receivesSos: true, receivesCheckin: true, createdAt: at(-94) },
    ],
  });
  tally.add('Family links', 2);

  // ─── Emergency contact matrix (primary / secondary / backup) ─────────────
  const mini = NEIGHBOURS.find((n) => n.key === 'mini')!;
  const abhijith = NEIGHBOURS.find((n) => n.key === 'abhijith')!;
  await prisma.emergencyContact.createMany({
    data: [
      { userId: elderId, name: 'Arun Nair', phone: FAMILY.phone, relationship: 'Son', callOrder: 1, notifyOnSos: true, linkedUserId: familyId, priorityLevel: 'primary' },
      { userId: elderId, name: mini.name, phone: mini.phone, relationship: 'Neighbour (committee secretary)', callOrder: 2, notifyOnSos: true, linkedUserId: p.neighbour.mini, priorityLevel: 'secondary' },
      { userId: elderId, name: abhijith.name, phone: abhijith.phone, relationship: 'Community volunteer', callOrder: 3, notifyOnSos: true, linkedUserId: p.neighbour.abhijith, priorityLevel: 'backup' },
      { userId: elderId, name: 'Dr. Latha Varma', phone: '9847103265', relationship: 'Family doctor', callOrder: 4, notifyOnSos: false },
    ],
  });
  tally.add('Emergency contacts', 4);

  // ─── Prescriptions ───────────────────────────────────────────────────────
  const rxMenon = newId();
  const rxCardio = newId();
  const rxEye = newId();
  const mk = (name: string, dosage: string, frequency: string, timeSlots: string[], instructions: string) =>
    ({ name, dosage, frequency, timeSlots, instructions, duration: 'Ongoing', durationDays: null });
  await prisma.prescription.createMany({
    data: [
      {
        id: rxMenon, userId: elderId, uploadedById: familyId, fileName: 'Dr Varma prescription.png', filePath: '/demo/rx/rx-varma.svg', fileType: 'image/svg+xml',
        doctorName: 'Dr. Latha Varma', hospitalName: 'Varma Family Clinic', prescriptionDate: at(-22), reviewed: true, createdAt: at(-22, '12:30'),
        notes: 'Continue present medicines. Review in four weeks with HbA1c and lipid profile.',
        extractedData: {
          doctorName: 'Dr. Latha Varma', hospitalName: 'Varma Family Clinic', prescriptionDate: istDay(-22),
          medications: [
            mk('Telmisartan', '40 mg', 'Once daily', ['08:00'], 'After breakfast'),
            mk('Metformin', '500 mg', 'Twice daily', ['08:30', '20:30'], 'With food'),
            mk('Atorvastatin', '10 mg', 'Once daily', ['21:30'], 'At night'),
            mk('Ecosprin', '75 mg', 'Once daily', ['13:30'], 'After lunch'),
            mk('Calcium + Vitamin D3', '1 tablet', 'Once daily', ['13:30'], 'After lunch'),
          ],
          notes: 'Low salt, low sugar diet. Walk 30 minutes daily.', nextVisitDate: istDay(24),
        } as Prisma.InputJsonValue,
      },
      {
        id: rxCardio, userId: elderId, uploadedById: familyId, fileName: 'Cardiology OPD.png', filePath: '/demo/rx/rx-cardio.svg', fileType: 'image/svg+xml',
        doctorName: 'Dr. Suresh Kumar', hospitalName: 'Anantha Multispeciality Hospital, Pattom', prescriptionDate: at(-60), reviewed: true, createdAt: at(-60, '13:00'),
        notes: 'BP 138/86 today. Echo normal. Review in three months.',
        extractedData: {
          doctorName: 'Dr. Suresh Kumar', hospitalName: 'Anantha Multispeciality Hospital, Pattom', prescriptionDate: istDay(-60),
          medications: [mk('Amlodipine', '5 mg', 'Once daily', ['21:00'], 'At night')],
          notes: 'Continue present medicines.', nextVisitDate: istDay(4),
        } as Prisma.InputJsonValue,
      },
      {
        id: rxEye, userId: elderId, uploadedById: familyId, fileName: 'Eye clinic.png', filePath: '/demo/rx/rx-eye.svg', fileType: 'image/svg+xml',
        doctorName: 'Dr. Shamina Rahman', hospitalName: 'Kowdiar Eye & Diabetes Centre', prescriptionDate: at(-45), reviewed: true, createdAt: at(-45, '17:30'),
        notes: 'Eye pressure borderline. Start drops, recheck in six weeks.',
        extractedData: {
          doctorName: 'Dr. Shamina Rahman', hospitalName: 'Kowdiar Eye & Diabetes Centre', prescriptionDate: istDay(-45),
          medications: [mk('Timolol eye drops 0.5%', '1 drop in each eye', 'Twice daily', ['08:00', '20:00'], 'Wait 5 minutes between different eye drops')],
          notes: 'Recheck eye pressure in six weeks.', nextVisitDate: istDay(13),
        } as Prisma.InputJsonValue,
      },
    ],
  });
  tally.add('Prescriptions', 3);

  // ─── Medicines (with the day each one was started) ───────────────────────
  const meds = [
    { name: 'Telmisartan', dosage: '40 mg', frequency: 'Once daily', slots: ['08:00'], instructions: 'After breakfast. For blood pressure.', doctor: 'Dr. Latha Varma', rx: rxMenon, from: -89 },
    { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily', slots: ['08:30', '20:30'], instructions: 'With food. For diabetes.', doctor: 'Dr. Latha Varma', rx: rxMenon, from: -89 },
    { name: 'Atorvastatin', dosage: '10 mg', frequency: 'Once daily', slots: ['21:30'], instructions: 'At night. For cholesterol.', doctor: 'Dr. Latha Varma', rx: rxMenon, from: -89 },
    { name: 'Ecosprin', dosage: '75 mg', frequency: 'Once daily', slots: ['13:30'], instructions: 'After lunch.', doctor: 'Dr. Latha Varma', rx: rxMenon, from: -89 },
    { name: 'Calcium + Vitamin D3', dosage: '1 tablet', frequency: 'Once daily', slots: ['13:30'], instructions: 'After lunch, with water.', doctor: 'Dr. Latha Varma', rx: rxMenon, from: -75 },
    { name: 'Amlodipine', dosage: '5 mg', frequency: 'Once daily', slots: ['21:00'], instructions: 'At night.', doctor: 'Dr. Suresh Kumar', rx: rxCardio, from: -60 },
    { name: 'Timolol eye drops 0.5%', dosage: '1 drop in each eye', frequency: 'Twice daily', slots: ['08:00', '20:00'], instructions: 'Wait 5 minutes between different eye drops.', doctor: 'Dr. Shamina Rahman', rx: rxEye, from: -45 },
    { name: 'Azithromycin', dosage: '250 mg', frequency: 'Once daily for 5 days', slots: ['09:00'], instructions: 'Finished course for a chest infection.', doctor: 'Dr. Latha Varma', rx: null, from: -48, to: -44, past: true },
  ].map((m) => ({ ...m, id: newId() }));

  await prisma.medication.createMany({
    data: meds.map((m) => ({
      id: m.id, userId: elderId, prescriptionId: m.rx, name: m.name, dosage: m.dosage, frequency: m.frequency,
      timeSlots: m.slots as Prisma.InputJsonValue, instructions: m.instructions, prescribingDoctor: m.doctor,
      endDate: m.past ? at(m.to!, '23:59') : null, isActive: !m.past, createdAt: at(m.from, '09:00'),
    })),
  });
  tally.add('Medicines', meds.length);

  // Ninety days of pill-box history: mostly taken, a rough patch during the chest infection.
  const reminders: Prisma.MedicationReminderCreateManyInput[] = [];
  const now = Date.now();
  let missedCount = 0;
  for (const m of meds) {
    const last = m.past ? m.to! : 0;
    for (let d = m.from; d <= last; d++) {
      const roughPatch = d >= -50 && d <= -43;
      for (const slot of m.slots) {
        const scheduledAt = localTimeToUtcDate(istDay(d), slot);
        let status: 'pending' | 'taken' | 'missed' = 'taken';
        let takenAt: Date | null = new Date(scheduledAt.getTime() + rng.int(2, 35) * 60_000);
        if (scheduledAt.getTime() > now) {
          status = 'pending';
          takenAt = null;
        } else if (rng.chance(roughPatch ? 0.22 : 0.035)) {
          status = 'missed';
          takenAt = null;
          missedCount++;
        }
        reminders.push({ medicationId: m.id, userId: elderId, scheduledAt, status, takenAt });
      }
    }
  }
  for (let i = 0; i < reminders.length; i += 500) await prisma.medicationReminder.createMany({ data: reminders.slice(i, i + 500) });
  tally.add('Medicine reminders (90 days of history)', reminders.length);
  void missedCount;

  // ─── Appointments ────────────────────────────────────────────────────────
  const appt = (daysOffset: number, hhmm: string, doctorName: string, specialty: string, hospital: string, notes: string, status: 'upcoming' | 'completed' | 'cancelled') =>
    ({ userId: elderId, doctorName, specialty, hospital, datetime: at(daysOffset, hhmm), notes, status, createdAt: at(Math.min(daysOffset, 0) - 6, '10:00') });
  await prisma.appointment.createMany({
    data: [
      appt(-78, '18:00', 'Dr. Latha Varma', 'General physician', 'Varma Family Clinic', 'First visit through EC. BP 148/92. Started on Telmisartan.', 'completed'),
      appt(-60, '11:30', 'Dr. Suresh Kumar', 'Cardiologist', 'Anantha Multispeciality Hospital, Pattom', 'ECG and echo done. Added Amlodipine at night.', 'completed'),
      appt(-50, '18:30', 'Dr. Latha Varma', 'General physician', 'Varma Family Clinic', 'Chest infection. Five-day antibiotic course.', 'completed'),
      appt(-45, '17:00', 'Dr. Shamina Rahman', 'Eye specialist', 'Kowdiar Eye & Diabetes Centre', 'Eye pressure borderline. Drops prescribed.', 'completed'),
      appt(-30, '10:00', 'Dr. Neethu Raj', 'Physiotherapist', 'Home visit', 'Rescheduled by the clinic.', 'cancelled'),
      appt(-22, '18:00', 'Dr. Latha Varma', 'General physician', 'Varma Family Clinic', 'Four-week review. BP 134/84. Medicines continued.', 'completed'),
      appt(-8, '11:00', 'Dr. Neethu Raj', 'Physiotherapist', 'Home visit', 'Knee strengthening. Exercise sheet left with the family.', 'completed'),
      appt(2, '10:30', 'Dr. Neethu Raj', 'Physiotherapist', 'Home visit', 'Second knee session at home.', 'upcoming'),
      appt(4, '11:00', 'Dr. Suresh Kumar', 'Cardiologist', 'Anantha Multispeciality Hospital, Pattom', 'Three-month review. Bring the BP diary. Arun will accompany.', 'upcoming'),
      appt(13, '16:30', 'Dr. Shamina Rahman', 'Eye specialist', 'Kowdiar Eye & Diabetes Centre', 'Eye pressure recheck. Carry the eye drops.', 'upcoming'),
      appt(24, '09:30', 'Dr. Latha Varma', 'General physician', 'Varma Family Clinic', 'Fasting blood test (HbA1c, lipids). No breakfast before.', 'upcoming'),
    ],
  });
  tally.add('Appointments', 11);

  // ─── Health notes: BP and sugar trending better, plus daily life ─────────
  type Author = 'elder' | 'family' | 'sister';
  const authorId = (a: Author) => (a === 'elder' ? elderId : a === 'family' ? familyId : sisterId);
  const notes: Array<{ d: number; by: Author; text: string }> = [];
  for (let d = -88; d <= -1; d += rng.int(2, 3)) {
    const progress = (d + 88) / 88; // 0 → 1 as BP improves
    const sys = Math.round(148 - progress * 17 + rng.int(-4, 4));
    const dia = Math.round(92 - progress * 10 + rng.int(-3, 3));
    notes.push({ d, by: rng.chance(0.7) ? 'family' : 'elder', text: `BP ${sys}/${dia}, pulse ${rng.int(68, 80)}. ${rng.pick(['Feeling well.', 'Slightly tired in the morning.', 'Took the medicines on time.', 'Had a good night’s sleep.', 'No headache today.'])}` });
    if (rng.chance(0.4)) notes.push({ d, by: 'family', text: `Fasting sugar ${Math.round(138 - progress * 26 + rng.int(-6, 6))} mg/dL.` });
  }
  notes.push(
    { d: -80, by: 'family', text: 'Dr. Varma advised cutting down salt. Started cooking dal and sambar with less salt.' },
    { d: -61, by: 'family', text: 'ECG and echo were normal. Dr. Suresh Kumar added a low-dose BP tablet at night.' },
    { d: -52, by: 'elder', text: 'Cough and slight fever since yesterday. Took rest and warm water with dry ginger.' },
    { d: -50, by: 'family', text: 'Chest infection confirmed. Five-day antibiotic started. Abhijith brought the medicines.' },
    { d: -43, by: 'elder', text: 'Cough is gone. Back to my morning walk with Girija.' },
    { d: -36, by: 'sister', text: 'Called Amma over video. She sounds cheerful and is eating well.' },
    { d: -24, by: 'family', text: 'HbA1c came back at 6.9% — good control. Report saved with the other health papers.' },
    { d: -17, by: 'elder', text: 'Slight knee pain on the stairs — took it slowly. Told Arun.' },
    { d: -9, by: 'family', text: 'Physiotherapist visited. Gave simple knee exercises to do after breakfast.' },
    { d: -3, by: 'elder', text: 'Eye drops running low. Arun ordered more from Sanjeevini.' },
  );
  await prisma.healthNote.createMany({
    data: notes.map((n) => ({ userId: elderId, createdById: authorId(n.by), content: n.text, createdAt: at(n.d, `${rng.int(7, 20)}:${String(rng.int(0, 59)).padStart(2, '0')}`) })),
  });
  tally.add('Health notes and readings', notes.length);

  // ─── Coverage and devices ────────────────────────────────────────────────
  await prisma.healthCoverageItem.createMany({
    data: [
      { userId: elderId, addedById: familyId, type: 'hospital_plan', label: 'Senior Health Plan', provider: 'Anantha Hospitals', policyNumber: 'ANH-4471-2290', filePath: '/demo/cards/health-plan.svg', fileName: 'health-plan-card.png', fileType: 'image/svg+xml', notes: 'Cashless at all Anantha hospitals. Helpline 0471 400 1111.', createdAt: at(-92) },
      { userId: elderId, addedById: familyId, type: 'insurance_plan', label: 'Senior Red Carpet policy', provider: 'Star Health', policyNumber: 'P/211111/01/2026/003481', filePath: '/demo/cards/insurance.svg', fileName: 'policy-card.png', fileType: 'image/svg+xml', notes: 'Sum insured Rs 10 lakh. Renews every August.', createdAt: at(-92) },
      { userId: elderId, addedById: sisterId, type: 'insurance_plan', label: 'Top-up cover (arranged from Dubai)', provider: 'TrustCover Advisors', policyNumber: 'TC-TOPUP-5521', notes: 'Added by Divya after a consultation. Covers Rs 5 lakh above the main policy.', createdAt: at(-40) },
      { userId: elderId, addedById: familyId, type: 'diagnostics', label: 'Annual full-body check-up', provider: 'Medilab Diagnostics', policyNumber: 'ML-882913', notes: 'Home sample collection included. Next one due in December.', createdAt: at(-85) },
      { userId: elderId, addedById: elderId, type: 'wearable_gadget', label: 'Smartwatch with fall detection', provider: 'Noise', policyNumber: 'Serial NZ-30912', notes: 'Paired with Arun’s phone. Charge every second night.', createdAt: at(-70) },
      { userId: elderId, addedById: familyId, type: 'wearable_gadget', label: 'Digital BP monitor', provider: 'Omron', policyNumber: 'HEM-7120', notes: 'Kept on the bedside table. Readings noted in the health notes.', createdAt: at(-88) },
    ],
  });
  tally.add('Health coverage and devices', 6);

  // ─── Mood, media, reminders, meals, voice ────────────────────────────────
  const moodWeights: Array<['great' | 'good' | 'okay' | 'low' | 'not_well', number]> = [['great', 0.2], ['good', 0.45], ['okay', 0.25], ['low', 0.08], ['not_well', 0.02]];
  const moodRows = Array.from({ length: 79 }, (_, i) => {
    const day = -(79 - i);
    const rough = day >= -52 && day <= -44;
    const r = rng.next();
    let acc = 0;
    let mood: 'great' | 'good' | 'okay' | 'low' | 'not_well' = 'good';
    for (const [m, w] of moodWeights) { acc += w; if (r <= acc) { mood = m; break; } }
    if (rough) mood = rng.chance(0.5) ? 'not_well' : 'low';
    return { userId: elderId, mood, createdAt: day === 0 ? minutesAgo(25) : at(day, `09:${String(rng.int(0, 40)).padStart(2, '0')}`) };
  }).filter((_, i) => i % 1 === 0 && rng.chance(0.9));
  await prisma.moodLog.createMany({ data: [...moodRows, { userId: elderId, mood: 'good' as const, createdAt: minutesAgo(25) }] });
  tally.add('Mood check-ins', moodRows.length + 1);

  await prisma.familyMediaLink.createMany({
    data: [
      { userId: elderId, addedById: familyId, title: 'Morning bhajans', url: 'https://www.youtube.com/results?search_query=morning+bhajans+playlist', mediaType: 'music', description: 'Amma’s favourite way to start the day.', createdAt: at(-90) },
      { userId: elderId, addedById: sisterId, title: 'Carnatic classics', url: 'https://www.youtube.com/results?search_query=carnatic+vocal+classics', mediaType: 'music', description: 'Sent by Divya from Dubai.', createdAt: at(-71) },
      { userId: elderId, addedById: familyId, title: 'Chair yoga for seniors', url: 'https://www.youtube.com/watch?v=RjqME9aAOpA', mediaType: 'video', description: 'Twenty gentle minutes after breakfast.', createdAt: at(-66) },
      { userId: elderId, addedById: familyId, title: 'Gentle morning stretches', url: 'https://www.youtube.com/watch?v=FZqVi9knjr8', mediaType: 'video', description: 'Ten minutes to loosen up before the walk.', createdAt: at(-58) },
      { userId: elderId, addedById: sisterId, title: 'Old Malayalam film songs', url: 'https://www.youtube.com/results?search_query=old+malayalam+film+songs+jukebox', mediaType: 'music', description: 'For the evenings.', createdAt: at(-33) },
      { userId: elderId, addedById: familyId, title: 'Guided meditation for seniors', url: 'https://www.youtube.com/watch?v=Lzvj_JVZkzY', mediaType: 'video', description: 'Ten minutes before bed helps with sleep.', createdAt: at(-14) },
    ],
  });
  tally.add('Music and video links', 6);

  await prisma.reminder.createMany({
    data: [
      { userId: elderId, message: 'Call Dr. Varma’s clinic to confirm the review', remindAt: hoursFromNow(2), notified: false },
      { userId: elderId, message: 'Water the tulsi plant', remindAt: at(1, '07:30'), notified: false },
      { userId: elderId, message: 'Call Divya — it is her birthday', remindAt: at(5, '09:00'), notified: false },
      { userId: elderId, message: 'Pay the KSEB bill', remindAt: at(3, '10:00'), notified: false },
      { userId: elderId, message: 'Take the BP reading before breakfast', remindAt: hoursAgo(26), notified: true },
      { userId: elderId, message: 'Call the plumber about the kitchen tap', remindAt: at(-6, '17:00'), notified: true },
      { userId: elderId, message: 'Bhajan sandhya at the community hall', remindAt: at(-11, '18:00'), notified: true },
      { userId: elderId, message: 'Start the eye drops tonight', remindAt: at(-45, '19:30'), notified: true },
    ],
  });
  tally.add('Voice reminders', 8);

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const mealNotes = ['Something light, please.', 'Puttu and kadala curry.', 'Appam and vegetable stew.', 'Kanji and payar thoran.', 'Idli and sambar.', 'Rice with fish curry, less salt.', 'Ragi puttu and a banana.', 'Upma with vegetables.'];
  const foodRows = Array.from({ length: 26 }, (_, i) => {
    const days = i * 3 + rng.int(0, 2);
    const status = i === 0 ? 'requested' : rng.chance(0.1) ? 'cancelled' : 'fulfilled';
    return {
      userId: elderId, requestType: rng.pick(mealTypes), notes: rng.chance(0.8) ? rng.pick(mealNotes) : null, status,
      handledBy: status === 'requested' ? null : status === 'cancelled' ? elderId : familyId,
      createdAt: i === 0 ? minutesAgo(40) : at(-days, `${rng.int(7, 19)}:${String(rng.int(0, 59)).padStart(2, '0')}`),
    };
  });
  await prisma.foodRequest.createMany({ data: foodRows });
  tally.add('Meal requests', foodRows.length);

  const voiceScripts: Array<[string, string, string, string]> = [
    ['Call my son', 'call_contact', 'Calling Arun now.', 'call_contact'],
    ['What medicines do I take now?', 'show_medicines', 'Here are your medicines for today.', 'show_medicines'],
    ['Remind me to call the plumber at five', 'set_reminder', 'I will remind you to call the plumber at 5 PM.', 'set_reminder'],
    ['Tell Arun I am not very hungry today', 'send_family_message', 'I have let Arun know.', 'send_family_message'],
    ['I want lunch', 'order_food', 'I have told your family you would like lunch.', 'order_food'],
    ['Do I have any appointments?', 'show_appointments', 'You see Dr. Suresh Kumar in four days at 11 AM.', 'show_appointments'],
    ['Book me with Dr. Varma tomorrow at four', 'book_appointment', 'Should I book Dr. Varma tomorrow at 4 PM?', 'none'],
    ['Order masala dosa', 'order_online', 'Should I open Swiggy and search for masala dosa?', 'none'],
    ['Call my daughter', 'call_contact', 'Calling Divya now.', 'call_contact'],
    ['How am I doing today?', 'check_status', 'You have taken your morning medicines. Well done.', 'none'],
  ];
  const voiceRows = Array.from({ length: 36 }, (_, i) => {
    const [transcript, intent, responseText, actionTaken] = voiceScripts[i % voiceScripts.length];
    return { userId: elderId, transcript, intent, responseText, actionTaken, createdAt: i === 0 ? hoursAgo(5) : at(-Math.floor(i * 2.4), `${rng.int(8, 20)}:${String(rng.int(0, 59)).padStart(2, '0')}`) };
  });
  await prisma.voiceLog.createMany({ data: voiceRows });
  tally.add('Voice assistant history', voiceRows.length);

  // ─── Emergencies over the three months (all resolved) ────────────────────
  const sos = (d: number, hhmm: string, triggerType: string, resolvedMin: number, by: string) => ({
    userId: elderId, triggerType, lat: DEMO_LAT, lng: DEMO_LNG, address: home, status: 'resolved', acknowledgedBy: by,
    createdAt: at(d, hhmm), resolvedAt: new Date(at(d, hhmm).getTime() + resolvedMin * 60_000),
  });
  await prisma.sOSEvent.createMany({
    data: [
      sos(-71, '07:42', 'manual', 12, familyId),
      sos(-34, '22:15', 'ambulance', 75, familyId),
      sos(-9, '10:05', 'manual', 8, familyId),
    ],
  });
  tally.add('Emergency alerts (past, resolved)', 3);

  // ─── Contacts book ───────────────────────────────────────────────────────
  await prisma.contact.createMany({
    data: [
      { elderUserId: elderId, addedById: familyId, name: mini.name, phone: mini.phone, category: 'neighbor', notes: 'Committee secretary, KGRA-12.', shareWithNeighbours: true, createdAt: at(-98) },
      { elderUserId: elderId, addedById: elderId, name: 'George Kurien', phone: '9447690318', category: 'neighbor', notes: 'Plays chess in the evenings.', shareWithNeighbours: true, createdAt: at(-80) },
      { elderUserId: elderId, addedById: elderId, name: 'Girija Warrier', phone: '9847106532', category: 'friend', notes: 'Morning walk partner.', createdAt: at(-90) },
      { elderUserId: elderId, addedById: elderId, name: 'Gopinathan (cousin)', phone: '9847204137', category: 'friend', notes: 'Lives in Kollam.', createdAt: at(-88) },
      { elderUserId: elderId, addedById: familyId, name: 'Sajeev Kumar', phone: '9446270918', category: 'serviceProvider', providerType: 'Auto driver', notes: 'Takes Amma to the hospital.', createdAt: at(-60) },
      { elderUserId: elderId, addedById: familyId, name: 'Shankaran', phone: '9446271365', category: 'serviceProvider', providerType: 'Plumber', createdAt: at(-77) },
      { elderUserId: elderId, addedById: familyId, name: 'Vijayan', phone: '9447162073', category: 'serviceProvider', providerType: 'Electrician', createdAt: at(-77) },
      { elderUserId: elderId, addedById: familyId, name: 'Anantha Multispeciality Hospital, Pattom', phone: '04712447000', category: 'hospital', notes: 'Emergency desk open 24 hours.', createdAt: at(-95) },
      { elderUserId: elderId, addedById: elderId, name: 'Leela (house help)', phone: '9744628305', category: 'other', notes: 'Comes at 7:30 AM.', createdAt: at(-95) },
      { elderUserId: elderId, addedById: familyId, name: 'Ganapathy Namboothiri', phone: '9447481726', category: 'other', notes: 'Priest for the festival pujas.', createdAt: at(-62) },
    ],
  });
  tally.add('Contacts', 10);

  // ─── Memories ────────────────────────────────────────────────────────────
  const mem = (d: number, by: string, img: string, caption: string) => ({ elderUserId: elderId, addedById: by, imagePath: `/demo/memories/${img}.svg`, caption, createdAt: at(d, '19:00') });
  await prisma.memory.createMany({
    data: [
      mem(-94, familyId, 'kitchen', 'Amma\u2019s first filter coffee on the verandah.'),
      mem(-81, sisterId, 'videocall', 'Sunday video call \u2014 the whole family on one screen.'),
      mem(-70, elderId, 'lalbagh', 'Morning walk at Kowdiar Park with Girija.'),
      mem(-58, familyId, 'temple', 'Our visit to the Padmanabhaswamy temple.'),
      mem(-48, familyId, 'balcony', 'Tea on the sit-out after the rain.'),
      mem(-45, familyId, 'pookalam', 'The Onam pookalam we made with the neighbours.'),
      mem(-45, sisterId, 'sadya', 'Onasadya at home \u2014 Divya joined by video from Dubai.'),
      mem(-39, sisterId, 'grandkids', 'The grandchildren\u2019s visit in the holidays.'),
      mem(-26, familyId, 'ganesha', 'Vinayaka Chaturthi at the community hall.'),
      mem(-14, familyId, 'diwali', 'Early lamps for Deepavali.'),
      mem(-11, sisterId, 'birthday', 'Amma\u2019s birthday cake, sent with love from Dubai.'),
      mem(-4, familyId, 'anniversary', 'Anniversary lunch with the neighbours.'),
    ],
  });
  tally.add('Family memories (photos)', 12);

  // ─── Bills: three months of paid history, current ones due ───────────────
  const billers = [
    { id: newId(), billerType: 'electricity' as const, billerName: 'KSEB', consumerNumber: '1145602238901', nickname: 'Home electricity', autopayEnabled: true },
    { id: newId(), billerType: 'water' as const, billerName: 'Kerala Water Authority', consumerNumber: 'KWA-TVM-33129', nickname: 'Water', autopayEnabled: false },
    { id: newId(), billerType: 'mobile' as const, billerName: 'Jio', consumerNumber: ELDER.phone, nickname: 'Amma’s mobile', autopayEnabled: false },
    { id: newId(), billerType: 'insurance' as const, billerName: 'LIC of India', consumerNumber: '778120412', nickname: 'LIC premium', autopayEnabled: false },
    { id: newId(), billerType: 'property_tax' as const, billerName: 'Thiruvananthapuram Corporation', consumerNumber: 'TC 9/1187', nickname: 'Property tax', autopayEnabled: false },
    { id: newId(), billerType: 'cable_tv' as const, billerName: 'Asianet Broadband', consumerNumber: '1209933811', nickname: 'TV and internet', autopayEnabled: false },
  ];
  await prisma.linkedBiller.createMany({ data: billers.map((b, i) => ({ ...b, elderUserId: elderId, addedById: familyId, createdAt: at(-96 + i) })) });
  const [elec, water, mobile, lic, tax, tv] = billers;
  const bills: Prisma.BillPaymentCreateManyInput[] = [];
  const addPaid = (billerId: string, amount: number, daysAgo: number) =>
    bills.push({ linkedBillerId: billerId, amount, status: 'paid', dueDate: at(-daysAgo + 4), paidAt: at(-daysAgo, '11:15'), razorpayPaymentId: `pay_demo_${newId().slice(0, 12)}`, createdAt: at(-daysAgo - 8) });
  [[1590, 85], [1712, 56], [1788, 26]].forEach(([a, d]) => addPaid(elec.id, a, d));
  [[372, 80], [396, 50], [388, 21]].forEach(([a, d]) => addPaid(water.id, a, d));
  [[399, 78], [399, 48], [399, 18]].forEach(([a, d]) => addPaid(mobile.id, a, d));
  [[320, 74], [320, 44], [320, 14]].forEach(([a, d]) => addPaid(tv.id, a, d));
  addPaid(tax.id, 14300, 70);
  addPaid(lic.id, 6200, 40);
  bills.push(
    { linkedBillerId: elec.id, amount: 1846, status: 'due', dueDate: at(6), createdAt: at(-3) },
    { linkedBillerId: water.id, amount: 428, status: 'due', dueDate: at(11), createdAt: at(-2) },
    { linkedBillerId: mobile.id, amount: 399, status: 'due', dueDate: at(3), createdAt: at(-2) },
    { linkedBillerId: tv.id, amount: 320, status: 'due', dueDate: at(9), createdAt: at(-1) },
    { linkedBillerId: lic.id, amount: 6200, status: 'due', dueDate: at(55), createdAt: at(-1) },
  );
  await prisma.billPayment.createMany({ data: bills });
  tally.add('Linked bills and payments', billers.length + bills.length);

  return { medications: meds.map((m) => ({ id: m.id, name: m.name })) };
}
