import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { DemoPeople } from './accounts';
import type { DemoCommunity } from './community';
import type { DemoProviders } from './providers';
import { addressOf, at, DEMO_LAT, DEMO_LNG, hoursAgo, makeRng, newId, type Tally } from './helpers';
import { ELDER } from './cast';

/** Titles / names of the platform-wide content the demo adds, so "remove demo data" can find it again. */
export const DEMO_NEWSLETTER_TITLES = [
  'Welcome to EC at Kowdiar Gardens',
  'Staying cool and hydrated through the dry spells',
  'Introducing medicine refill reminders',
  'Onam greetings and a thank-you to our volunteers',
  'Draft: Community volunteers programme',
  'Navaratri and Vidyarambham: a note for families abroad',
];
export const DEMO_GERIATRIC_NAMES = [
  'Thanal Seniors Self-Help Group', 'Santhwanam Palliative Care Trust', 'Sneha Bhavan Elder Care Home', 'Pranam Physiotherapy Centre',
  'Ananda Ayurvedic Massage Centre', 'Shanti Yoga for Seniors (Kowdiar Park)', 'Nirmala Meditation Hall', 'Doctor at Door Home Visits',
  'Dhanyam Ayurveda Centre', 'Anantha Multispeciality Hospital', 'Rapid Ambulance Service', 'Smruti Dementia Day Care',
];

const razorpayDemo = (kind: string) => `${kind}_demo_${newId().replace(/-/g, '').slice(0, 14)}`;
const feeSplit = (total: number) => {
  const fee = Math.round(total * 0.05 * 100) / 100;
  return { platformFeeAmount: fee, netAmountForProvider: total - fee };
};

/** Doctors' bookings, rides, advisory, property care, orders, rentals and the platform directories. */
export async function buildServices(p: DemoPeople, prov: DemoProviders, comm: DemoCommunity, tally: Tally, healthMeds: Array<{ id: string; name: string }>) {
  const { elderId, familyId, sisterId } = p;
  const nId = comm.neighborhoodId;
  const rng = makeRng(404);
  const home = addressOf(ELDER.house);
  const ratings: Prisma.ProviderRatingCreateManyInput[] = [];
  const [drVarma, drJoseph, drShamina] = comm.doctorIds;

  // ─── Doctors' slots and bookings ─────────────────────────────────────────
  const slots: Array<{ id: string; doctorId: string; startsAt: Date; isBooked: boolean }> = [];
  const slotAt = (doctorId: string, day: number, hhmm: string, booked = false) => {
    const s = { id: newId(), doctorId, startsAt: at(day, hhmm), isBooked: booked };
    slots.push(s);
    return s;
  };
  for (const d of [drVarma, drJoseph, drShamina]) for (let day = 1; day <= 7; day++) for (const t of ['10:00', '10:30', '11:00', '17:00', '17:30']) slotAt(d, day, t);
  const bPast1 = slotAt(drVarma, -78, '18:00', true);
  const bPast2 = slotAt(drVarma, -50, '18:30', true);
  const bPast3 = slotAt(drVarma, -22, '18:00', true);
  const bEye = slotAt(drShamina, -45, '17:00', true);
  const bPaid = slotAt(drVarma, 1, '11:30', true);
  const bConfirmed = slotAt(drVarma, 2, '10:00', true);
  const bPending = slotAt(drJoseph, 4, '17:00', true);
  await prisma.doctorSlot.createMany({ data: slots });

  const paidFields = () => ({ razorpayPaymentId: razorpayDemo('pay'), razorpayOrderId: razorpayDemo('order') });
  const docBookings = [
    { id: newId(), doctorId: drVarma, slotId: bPast1.id, status: 'closed' as const, amount: 600, ...paidFields(), createdAt: at(-80) },
    { id: newId(), doctorId: drVarma, slotId: bPast2.id, status: 'closed' as const, amount: 600, ...paidFields(), createdAt: at(-52) },
    { id: newId(), doctorId: drVarma, slotId: bPast3.id, status: 'closed' as const, amount: 600, ...paidFields(), createdAt: at(-24) },
    { id: newId(), doctorId: drShamina, slotId: bEye.id, status: 'closed' as const, amount: 700, ...paidFields(), createdAt: at(-47) },
    { id: newId(), doctorId: drVarma, slotId: bPaid.id, status: 'paid' as const, amount: 600, ...paidFields(), createdAt: at(-2) },
    { id: newId(), doctorId: drVarma, slotId: bConfirmed.id, status: 'confirmed' as const, amount: 600, createdAt: at(-1) },
    { id: newId(), doctorId: drJoseph, slotId: bPending.id, status: 'pending_confirmation' as const, amount: 800, createdAt: hoursAgo(5) },
  ];
  await prisma.doctorBooking.createMany({ data: docBookings.map((b) => ({ ...b, elderUserId: elderId, bookedById: familyId })) });
  ratings.push(
    { providerId: prov.id.doctor, raterUserId: familyId, stars: 5, comment: 'Dr. Latha was patient and explained everything to Amma in simple Malayalam.', doctorBookingId: docBookings[0].id, createdAt: at(-77) },
    { providerId: prov.id.doctor, raterUserId: familyId, stars: 5, comment: 'Quick diagnosis of the chest infection and clear instructions.', doctorBookingId: docBookings[1].id, createdAt: at(-49) },
    { providerId: prov.id.doctor, raterUserId: elderId, stars: 4, comment: 'Kind doctor. The waiting time was a little long.', doctorBookingId: docBookings[2].id, createdAt: at(-21) },
  );
  tally.add('Doctors, slots and bookings', slots.length + docBookings.length);

  // ─── Auto and taxi ───────────────────────────────────────────────────────
  const drivers = [
    { id: newId(), name: 'Sajeev Kumar', phone: '9446270918', whatsapp: '9446270918', vehicleNumber: 'KL 01 BC 4521', serviceArea: 'Kowdiar, Pattom, Vazhuthacaud, Medical College', perKmRate: 16, perMinWaitRate: 1.5, providerId: prov.id.auto, sortOrder: 1 },
    { id: newId(), name: 'Rajan', phone: '9847601553', whatsapp: '9847601553', vehicleNumber: 'KL 01 AD 7712', serviceArea: 'Kowdiar, Kuravankonam, Sasthamangalam', perKmRate: null, perMinWaitRate: null, providerId: null, sortOrder: 2 },
    { id: newId(), name: 'Kunjumon', phone: '9495120364', whatsapp: null, vehicleNumber: 'KL 01 BF 3098', serviceArea: 'Pattom, Palayam, East Fort', perKmRate: 18, perMinWaitRate: 1.5, providerId: null, sortOrder: 3 },
  ];
  await prisma.autoDriver.createMany({ data: drivers.map((d) => ({ ...d, neighborhoodId: nId })) });
  await prisma.autoRateCard.create({ data: { neighborhoodId: nId, perKmRate: 15, perMinWaitRate: 1.5 } });
  const ride = (id: string, daysAgo: number, driverId: string, drop: string, dropLat: number, dropLng: number, fare: number, status: 'closed' | 'confirmed' | 'pending_confirmation' | 'cancelled') => ({
    id: newId(), driverId, pickupAddress: home, pickupLat: DEMO_LAT, pickupLng: DEMO_LNG, dropAddress: drop, dropLat, dropLng, fareAmount: fare, status,
    razorpayOrderId: status === 'closed' ? razorpayDemo('order') : null, razorpayPaymentId: status === 'closed' ? razorpayDemo('pay') : null, paidAt: status === 'closed' ? at(-daysAgo) : null,
    createdAt: daysAgo > 0 ? at(-daysAgo, '08:00') : hoursAgo(Number(id)),
  });
  const rides = [
    ride('0', 78, drivers[0].id, 'Varma Family Clinic, Kowdiar Junction', 8.5208, 76.9576, 60, 'closed'),
    ride('0', 62, drivers[0].id, 'Padmanabhaswamy Temple, East Fort', 8.4828, 76.9437, 210, 'closed'),
    ride('0', 60, drivers[0].id, 'Anantha Multispeciality Hospital, Pattom', 8.5240, 76.9457, 90, 'closed'),
    ride('0', 45, drivers[1].id, 'Kowdiar Eye & Diabetes Centre', 8.5189, 76.9599, 40, 'closed'),
    ride('0', 33, drivers[0].id, 'Napier Museum and Zoo', 8.5081, 76.9547, 120, 'closed'),
    ride('0', 22, drivers[0].id, 'Varma Family Clinic, Kowdiar Junction', 8.5208, 76.9576, 60, 'closed'),
    ride('0', 21, drivers[2].id, 'Technopark, Kazhakkoottam', 8.5574, 76.8813, 480, 'cancelled'),
    ride('0', 9, drivers[0].id, 'Anantha Multispeciality Hospital, Pattom', 8.5240, 76.9457, 90, 'closed'),
    ride('6', 0, drivers[0].id, 'Kowdiar Eye & Diabetes Centre', 8.5189, 76.9599, 40, 'confirmed'),
    ride('2', 0, drivers[1].id, 'Padmanabhaswamy Temple, East Fort', 8.4828, 76.9437, 210, 'pending_confirmation'),
  ];
  await prisma.autoBooking.createMany({ data: rides.map((b) => ({ ...b, elderUserId: elderId, bookedById: familyId })) });
  const closedRides = rides.filter((r) => r.status === 'closed' && r.driverId === drivers[0].id);
  ratings.push(
    { providerId: prov.id.auto, raterUserId: familyId, stars: 5, comment: 'Sajeev helped Amma into the auto and waited at the hospital. Very kind.', autoBookingId: closedRides[1].id, createdAt: at(-62) },
    { providerId: prov.id.auto, raterUserId: familyId, stars: 5, comment: 'On time every Thursday. Drives slowly and carefully.', autoBookingId: closedRides[3].id, createdAt: at(-33) },
    { providerId: prov.id.auto, raterUserId: elderId, stars: 4, comment: 'Good ride to the doctor.', autoBookingId: closedRides[4].id, createdAt: at(-22) },
  );
  tally.add('Auto drivers and rides', drivers.length + 1 + rides.length);

  // ─── Advisory ────────────────────────────────────────────────────────────
  const willId = newId();
  const poaId = newId();
  const insId = newId();
  const topupId = newId();
  const rmId = newId();
  await prisma.consultationRequest.createMany({
    data: [
      { id: poaId, elderUserId: elderId, requestedById: familyId, category: 'legal_will', requirementDetails: { documentType: 'Power of Attorney', city: 'Thiruvananthapuram' }, notes: 'Amma wants Arun to handle the bank and property tax work while Divya is abroad.', assignedExpertId: prov.expert.legal_will, status: 'closed', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-70), createdAt: at(-72) },
      { id: insId, elderUserId: elderId, requestedById: familyId, category: 'senior_insurance', requirementDetails: { insuranceType: 'Senior health', city: 'Thiruvananthapuram' }, notes: 'Existing conditions: blood pressure and diabetes.', assignedExpertId: prov.expert.senior_insurance, status: 'closed', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-62), createdAt: at(-64) },
      { id: topupId, elderUserId: elderId, requestedById: sisterId, category: 'senior_insurance', requirementDetails: { insuranceType: 'Top-up cover', city: 'Thiruvananthapuram' }, notes: 'Requested from Dubai: a top-up so a long hospital stay is covered.', assignedExpertId: prov.expert.senior_insurance, status: 'closed', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-41), createdAt: at(-42) },
      { id: willId, elderUserId: elderId, requestedById: familyId, category: 'legal_will', requirementDetails: { documentType: 'Registered Will', city: 'Thiruvananthapuram' }, notes: 'Amma wants to divide the house and some gold equally between Arun and Divya.', assignedExpertId: prov.expert.legal_will, status: 'in_progress', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-9), createdAt: at(-10) },
      { id: rmId, elderUserId: elderId, requestedById: familyId, category: 'reverse_mortgage', requirementDetails: { propertyValue: '1.6 crore', city: 'Thiruvananthapuram' }, notes: 'Just exploring — would like to understand the risks first.', assignedExpertId: null, status: 'submitted', createdAt: hoursAgo(30) },
    ],
  });
  await prisma.vaultDocument.createMany({
    data: [
      { consultationRequestId: willId, uploadedById: familyId, fileName: 'Will - documents checklist.pdf', filePath: '/demo/docs/will-checklist.pdf', fileType: 'application/pdf', createdAt: at(-8) },
      { consultationRequestId: insId, uploadedById: p.support.insurance, fileName: 'Plan comparison.pdf', filePath: '/demo/docs/policy-comparison.pdf', fileType: 'application/pdf', createdAt: at(-60) },
      { consultationRequestId: topupId, uploadedById: p.support.insurance, fileName: 'Top-up plan comparison.pdf', filePath: '/demo/docs/policy-comparison.pdf', fileType: 'application/pdf', createdAt: at(-38) },
    ],
  });
  ratings.push(
    { providerId: prov.id.legal, raterUserId: familyId, stars: 5, comment: 'Adv. Ramesh registered the power of attorney at home. Amma did not have to travel.', consultationId: poaId, createdAt: at(-60) },
    { providerId: prov.id.insurance, raterUserId: familyId, stars: 5, comment: 'Nisha compared five plans and was honest about waiting periods.', consultationId: insId, createdAt: at(-55) },
    { providerId: prov.id.insurance, raterUserId: sisterId, stars: 5, comment: 'Arranged the top-up from Dubai with no stress.', consultationId: topupId, createdAt: at(-36) },
  );
  tally.add('Advisory consultations and vault documents', 8);

  // ─── Property care (an NRI-style monthly check of the house) ─────────────
  const subId = newId();
  await prisma.propertySubscription.create({
    data: { id: subId, elderUserId: elderId, subscribedById: familyId, providerId: prov.id.property, frequency: 'monthly', status: 'active', fee: 1500, createdAt: at(-82) },
  });
  const insp = [newId(), newId(), newId()];
  await prisma.propertyInspection.createMany({
    data: [
      { id: insp[0], subscriptionId: subId, submittedById: p.support.property, inspectedAt: at(-78, '11:00'), plumbingStatus: 'pass', electricalStatus: 'pass', structuralStatus: 'pass', notes: 'First visit. All fittings working, no leaks, gate locks and compound wall in good condition. Water meter and KSEB meter readings noted.', mediaPaths: ['/demo/inspection/electrical.svg'], createdAt: at(-78, '12:00') },
      { id: insp[1], subscriptionId: subId, submittedById: p.support.property, inspectedAt: at(-48, '11:00'), plumbingStatus: 'pass', electricalStatus: 'needs_attention', structuralStatus: 'pass', notes: 'Earthing wire loose at the main board; the verandah light flickers. Terrace waterproofing is holding after the rains.', mediaPaths: ['/demo/inspection/electrical.svg'], createdAt: at(-48, '13:00') },
      { id: insp[2], subscriptionId: subId, submittedById: p.support.property, inspectedAt: at(-18, '11:00'), plumbingStatus: 'fail', electricalStatus: 'pass', structuralStatus: 'needs_attention', notes: 'Kitchen tap leaking at the joint and damp patch starting on the bedroom wall after the northeast monsoon rains.', mediaPaths: ['/demo/inspection/plumbing.svg', '/demo/inspection/wall.svg'], createdAt: at(-18, '13:00') },
    ],
  });
  const est = { earth: newId(), tap: newId(), wall: newId(), terrace: newId() };
  await prisma.repairEstimate.createMany({
    data: [
      { id: est.earth, inspectionId: insp[1], itemDescription: 'Fix the earthing wire and replace the flickering light fitting', estimatedCost: 1800, isApproved: true, createdAt: at(-47) },
      { id: est.tap, inspectionId: insp[2], itemDescription: 'Replace kitchen tap and fix the leaking joint', estimatedCost: 2800, isApproved: true, createdAt: at(-17) },
      { id: est.wall, inspectionId: insp[2], itemDescription: 'Waterproofing treatment for the bedroom wall seepage', estimatedCost: 9500, isApproved: false, createdAt: at(-17) },
      { id: est.terrace, inspectionId: insp[2], itemDescription: 'Clear and re-slope the terrace drain', estimatedCost: 2200, isApproved: true, createdAt: at(-17) },
    ],
  });
  const invEarth = newId();
  const invTap = newId();
  await prisma.propertyInvoice.createMany({
    data: [
      { id: invEarth, repairEstimateId: est.earth, amount: 1800, status: 'closed', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-44), createdAt: at(-46) },
      { id: invTap, repairEstimateId: est.tap, amount: 2800, status: 'paid', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-14), createdAt: at(-16) },
      { id: newId(), repairEstimateId: est.terrace, amount: 2200, status: 'pending', createdAt: at(-16) },
    ],
  });
  ratings.push({ providerId: prov.id.property, raterUserId: familyId, stars: 4, comment: 'Good report with photos each month. The electrician came the very next day.', propertyInvoiceId: invEarth, createdAt: at(-43) });
  tally.add('Property care (subscription, inspections, estimates, invoices)', 14);

  // ─── Orders: three months across pharmacy, nursing, grocery, physio, companions ─
  type Svc = 'pharmacy' | 'nursing' | 'grocery' | 'physio' | 'companion';
  type St = 'pending' | 'paid' | 'confirmed' | 'delivered' | 'closed' | 'cancelled';
  interface OrderSeed { provider: Svc; status: St; by: 'elder' | 'family'; when: Date; lines: Array<[number, number]>; cod?: boolean; rating?: { stars: number; comment: string } }
  const reviews: Record<Svc, Array<[number, string]>> = {
    pharmacy: [[5, 'Delivered the same afternoon and the staff explained each medicine.'], [5, 'Thank you for the monthly reminder. Very convenient.'], [4, 'On time. The strips were near expiry once but replaced promptly.'], [5, 'Discreet packing and quick delivery.'], [5, 'Always polite with Amma on the phone.']],
    nursing: [[5, 'The nurse was gentle and professional with Amma.'], [5, 'Reliable night attendant. Very caring.']],
    grocery: [[4, 'Fresh vegetables, packed in small bags that Amma can carry.'], [5, 'Good quality rice and coconut oil. Delivered on time.'], [4, 'Fruit was fresh. Sometimes a little late.']],
    physio: [[5, 'Dr. Neethu explained every exercise and checked Amma’s balance patiently.'], [5, 'Amma’s knee pain is much better after the sessions.']],
    companion: [[5, 'Lissy chats with Amma and takes her to the park. Amma looks forward to her visits.'], [5, 'Accompanied Amma to the hospital and updated us on every step.']],
  };
  const seeds: OrderSeed[] = [];
  // Pharmacy: a refill roughly every ten days, plus devices and supplies.
  const pharmacyBasket: Array<Array<[number, number]>> = [[[3, 2], [4, 1]], [[0, 2], [1, 1]], [[6, 1], [9, 1]], [[7, 1], [1, 2]], [[10, 2], [11, 1], [13, 1]], [[16, 1], [17, 1]], [[2, 1], [5, 1]], [[18, 1], [19, 1]], [[12, 1], [8, 1]], [[14, 2], [3, 1]], [[20, 1], [21, 1]]];
  for (let i = 0, d = 87; d > 6; i++, d -= rng.int(7, 12)) {
    const status: St = rng.chance(0.08) ? 'cancelled' : 'closed';
    const by = rng.chance(0.28) ? 'elder' : 'family';
    const cod = by === 'elder' && rng.chance(0.6);
    const [stars, comment] = rng.pick(reviews.pharmacy);
    seeds.push({ provider: 'pharmacy', status, by, when: at(-d, `${rng.int(9, 18)}:${String(rng.int(0, 59)).padStart(2, '0')}`), lines: pharmacyBasket[i % pharmacyBasket.length], cod, rating: status === 'closed' && rng.chance(0.72) ? { stars, comment } : undefined });
  }
  seeds.push(
    { provider: 'pharmacy', status: 'delivered', by: 'family', when: at(-3, '12:20'), lines: [[3, 1], [2, 1], [0, 2]] },
    { provider: 'pharmacy', status: 'delivered', by: 'elder', when: at(-1, '17:10'), cod: true, lines: [[5, 1], [1, 1]] },
    { provider: 'pharmacy', status: 'confirmed', by: 'family', when: hoursAgo(5), lines: [[12, 1], [8, 1]] },
    { provider: 'pharmacy', status: 'paid', by: 'family', when: hoursAgo(2), lines: [[4, 2]] },
    { provider: 'pharmacy', status: 'pending', by: 'elder', when: hoursAgo(1), lines: [[2, 1], [0, 1]] },
    { provider: 'pharmacy', status: 'pending', by: 'family', when: hoursAgo(5), lines: [[8, 1]] },
  );
  // Grocery: weekly-ish.
  for (let d = 84; d > 4; d -= rng.int(6, 10)) {
    const [stars, comment] = rng.pick(reviews.grocery);
    seeds.push({ provider: 'grocery', status: 'closed', by: rng.chance(0.4) ? 'elder' : 'family', when: at(-d, `${rng.int(7, 11)}:30`), lines: [[rng.int(0, 1), 1], [rng.int(2, 7), rng.int(1, 2)], [rng.int(2, 7), 1]], rating: rng.chance(0.6) ? { stars, comment } : undefined });
  }
  seeds.push({ provider: 'grocery', status: 'delivered', by: 'elder', when: at(-2, '08:00'), lines: [[0, 1], [2, 2], [3, 1]] });
  // Nursing, physio, companions.
  seeds.push(
    { provider: 'nursing', status: 'closed', by: 'family', when: at(-48, '09:00'), lines: [[2, 1]], rating: { stars: 5, comment: reviews.nursing[0][1] } },
    { provider: 'nursing', status: 'closed', by: 'family', when: at(-49, '19:00'), lines: [[1, 3]], rating: { stars: 5, comment: reviews.nursing[1][1] } },
    { provider: 'nursing', status: 'confirmed', by: 'family', when: at(-1, '19:00'), lines: [[1, 2]] },
    { provider: 'physio', status: 'closed', by: 'family', when: at(-30, '10:00'), lines: [[0, 2]], rating: { stars: 5, comment: reviews.physio[0][1] } },
    { provider: 'physio', status: 'closed', by: 'family', when: at(-16, '10:00'), lines: [[1, 1]], rating: { stars: 5, comment: reviews.physio[1][1] } },
    { provider: 'physio', status: 'confirmed', by: 'family', when: at(-1, '16:00'), lines: [[0, 1]] },
    { provider: 'companion', status: 'closed', by: 'family', when: at(-40, '09:00'), lines: [[3, 1]], rating: { stars: 5, comment: reviews.companion[0][1] } },
    { provider: 'companion', status: 'closed', by: 'elder', when: at(-20, '09:00'), lines: [[2, 2]], rating: { stars: 5, comment: reviews.companion[1][1] } },
    { provider: 'companion', status: 'delivered', by: 'family', when: at(-2, '09:00'), lines: [[1, 1]] },
  );
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  const orderIds: string[] = [];
  seeds.forEach((s) => {
    const orderId = newId();
    orderIds.push(orderId);
    const catalog = prov.catalog[s.provider];
    const lines = s.lines.map(([idx, qty]) => ({ item: catalog[idx % catalog.length], qty }));
    const total = lines.reduce((sum, l) => sum + l.item.price * l.qty, 0);
    const isPaid = s.status !== 'pending' && s.status !== 'cancelled' && !s.cod;
    orderRows.push({
      id: orderId, elderUserId: elderId, placedByUserId: s.by === 'elder' ? elderId : familyId, providerId: prov.id[s.provider],
      status: s.status, paymentMethod: s.cod ? 'cod' : 'razorpay', totalAmount: total, deliveryAddress: home,
      razorpayOrderId: isPaid || s.status === 'pending' ? razorpayDemo('order') : null,
      razorpayPaymentId: isPaid ? razorpayDemo('pay') : null, paidAt: isPaid ? s.when : null,
      ...(isPaid ? feeSplit(total) : {}), createdAt: s.when,
    });
    for (const l of lines) itemRows.push({ orderId, catalogItemId: l.item.id, name: l.item.name, price: l.item.price, quantity: l.qty });
    if (s.rating) ratings.push({ providerId: prov.id[s.provider], raterUserId: s.by === 'elder' ? elderId : familyId, stars: s.rating.stars, comment: s.rating.comment, orderId, createdAt: new Date(s.when.getTime() + 3 * 86_400_000) });
  });
  await prisma.order.createMany({ data: orderRows });
  await prisma.orderItem.createMany({ data: itemRows });
  tally.add('Orders and order items', orderRows.length + itemRows.length);

  // Monthly refill reminders (pharmacy auto-reorder)
  const calciumMed = healthMeds.find((m) => m.name.startsWith('Calcium'));
  const tplCalcium = newId();
  const tplMulti = newId();
  const deliveredCalcium = orderIds[orderIds.length - 6 - 0] ?? null;
  await prisma.recurringOrderTemplate.createMany({
    data: [
      { id: tplCalcium, elderUserId: elderId, providerId: prov.id.pharmacy, catalogItemId: prov.catalog.pharmacy[3].id, medicationId: calciumMed?.id ?? null, unitsPerMonth: 1, isActive: true, createdAt: at(-70) },
      { id: tplMulti, elderUserId: elderId, providerId: prov.id.pharmacy, catalogItemId: prov.catalog.pharmacy[4].id, medicationId: null, unitsPerMonth: 1, isActive: true, createdAt: at(-70) },
    ],
  });
  await prisma.recurringOrderSuggestion.createMany({
    data: [
      { templateId: tplCalcium, suggestedAt: at(-64), status: 'approved', orderId: orderIds[0] },
      { templateId: tplCalcium, suggestedAt: at(-34), status: 'approved', orderId: orderIds[3] },
      { templateId: tplCalcium, suggestedAt: hoursAgo(20), status: 'pendingApproval' },
      { templateId: tplMulti, suggestedAt: at(-35), status: 'declined' },
      { templateId: tplMulti, suggestedAt: hoursAgo(20), status: 'pendingApproval' },
    ],
  });
  void deliveredCalcium;
  tally.add('Monthly refill reminders', 7);

  await prisma.providerRating.createMany({ data: ratings });
  tally.add('Ratings and reviews', ratings.length);

  // ─── Rentals (platform-wide) ─────────────────────────────────────────────
  const rentals = [
    { id: newId(), postedById: p.neighbour.raghavan, title: 'Independent 3BHK house near Kowdiar Park', listingType: 'entire_house' as const, monthlyRent: 38000, securityDeposit: 200000, address: 'Road 2, Kowdiar Gardens', city: 'Thiruvananthapuram', description: 'Ground and first floor, wide entrance, covered car porch and a small garden. Quiet road, five minutes from the park.', houseRules: 'No smoking. Pets with prior approval.', wheelchairRamp: true, grabBars: true, noStepEntry: true, groundFloor: true, imagePath: '/demo/rentals/villa.svg', contactPhone: '9447205613', status: 'active' as const, createdAt: at(-20) },
    { id: newId(), postedById: p.neighbour.girija, title: 'Ground-floor 2BHK, senior-friendly house in Pattom', listingType: 'entire_house' as const, monthlyRent: 26000, securityDeposit: 120000, address: 'Pattom', city: 'Thiruvananthapuram', description: 'Single-storey house with no steps, grab bars in the bathrooms and a caretaker room.', houseRules: 'Vegetarian kitchen preferred.', wheelchairRamp: true, grabBars: true, noStepEntry: true, groundFloor: true, imagePath: '/demo/rentals/ground-floor.svg', contactPhone: '9847106532', status: 'active' as const, createdAt: at(-34) },
    { id: newId(), postedById: p.neighbour.annamma, title: 'Sunny room with attached bath in a senior-friendly home', listingType: 'room' as const, monthlyRent: 9500, securityDeposit: 28000, address: 'Vazhuthacaud', city: 'Thiruvananthapuram', description: 'Private room with attached bath in a quiet home, meals available, nurse on call.', houseRules: 'Vegetarian kitchen.', wheelchairRamp: true, grabBars: true, noStepEntry: true, groundFloor: true, imagePath: '/demo/rentals/room.svg', contactPhone: '9446731052', status: 'active' as const, createdAt: at(-26) },
    { id: newId(), postedById: p.neighbour.venkatesh, title: 'Villa with garden, Nanthancode', listingType: 'entire_house' as const, monthlyRent: 55000, securityDeposit: 330000, address: 'Nanthancode', city: 'Thiruvananthapuram', description: 'Three bedrooms, a lawn with coconut trees and a covered sit-out. Step-free entrance.', houseRules: null, wheelchairRamp: false, grabBars: false, noStepEntry: true, groundFloor: true, imagePath: '/demo/rentals/villa.svg', contactPhone: '9895740126', status: 'in_negotiation' as const, createdAt: at(-45) },
    { id: newId(), postedById: p.neighbour.fathima, title: 'Outhouse room for a live-in caregiver, Kuravankonam', listingType: 'room' as const, monthlyRent: 7500, securityDeposit: 15000, address: 'Kuravankonam', city: 'Thiruvananthapuram', description: 'Simple furnished room with its own entrance, close to the church and bus stop.', houseRules: null, wheelchairRamp: false, grabBars: false, noStepEntry: false, groundFloor: true, imagePath: null, contactPhone: '9496028374', status: 'rented' as const, createdAt: at(-60) },
  ];
  await prisma.rentalListing.createMany({ data: rentals.map((r) => ({ ...r, neighborhoodId: nId })) });
  await prisma.rentalInquiry.createMany({
    data: [
      { listingId: rentals[1].id, inquirerId: familyId, message: 'Looking for a ground-floor house for my mother’s cousin visiting from Kollam. Can we visit this weekend?', visitDate: at(5, '11:00'), status: 'scheduled', createdAt: at(-3) },
      { listingId: rentals[2].id, inquirerId: sisterId, message: 'Is the room available from next month for a relative?', status: 'open', createdAt: at(-1) },
      { listingId: rentals[0].id, inquirerId: p.neighbour.rahul, message: 'Interested for my parents moving from Kottayam. Is the rent negotiable?', status: 'closed', createdAt: at(-15) },
    ],
  });
  tally.add('Rentals and inquiries', rentals.length + 3);

  // ─── Platform directories and content ────────────────────────────────────
  const geri = (name: string, category: 'self_help_group' | 'ngo' | 'palliative_care' | 'physiotherapy' | 'massage' | 'yoga' | 'meditation' | 'doctor_home_visit' | 'ayurveda' | 'hospital' | 'ambulance', phone: string, description: string, address: string) =>
    ({ name, category, phone, description, address, city: 'Thiruvananthapuram', pincode: '695003', isActive: true, verified: true, addedById: p.adminId, createdAt: at(-80) });
  await prisma.geriatricCareListing.createMany({
    data: [
      geri(DEMO_GERIATRIC_NAMES[0], 'self_help_group', '9447090101', 'A peer group of senior women who meet twice a week for crafts, savings and mutual support.', 'Kowdiar'),
      geri(DEMO_GERIATRIC_NAMES[1], 'palliative_care', '9447090102', 'Home-based palliative and end-of-life care with a trained team, volunteers and counsellors.', 'Pattom'),
      geri(DEMO_GERIATRIC_NAMES[2], 'ngo', '9447090103', 'A trust supporting elders without family: meals, medicines and companionship.', 'Vazhuthacaud'),
      geri(DEMO_GERIATRIC_NAMES[3], 'physiotherapy', '9447090104', 'Balance training, post-fracture rehabilitation and home visits.', 'Kuravankonam'),
      geri(DEMO_GERIATRIC_NAMES[4], 'massage', '9447090105', 'Gentle therapeutic massage by trained women therapists, at home or in the centre.', 'Kowdiar'),
      geri(DEMO_GERIATRIC_NAMES[5], 'yoga', '9447090106', 'Chair yoga and breathing classes designed for seniors, held near Kowdiar Park.', 'Kowdiar'),
      geri(DEMO_GERIATRIC_NAMES[6], 'meditation', '9447090107', 'Guided meditation every morning in a quiet hall.', 'Sasthamangalam'),
      geri(DEMO_GERIATRIC_NAMES[7], 'doctor_home_visit', '9447090108', 'Doctors who visit homes for check-ups, injections and sample collection.', 'Thiruvananthapuram city'),
      geri(DEMO_GERIATRIC_NAMES[8], 'ayurveda', '9447090109', 'Ayurvedic consultation and Panchakarma for joint pain and sleep problems.', 'Poojappura'),
      geri(DEMO_GERIATRIC_NAMES[9], 'hospital', '04712447000', 'Multispeciality hospital with a dedicated geriatric department.', 'Pattom'),
      geri(DEMO_GERIATRIC_NAMES[10], 'ambulance', '9447090110', 'Cardiac and basic-life-support ambulances, available 24 hours.', 'Thiruvananthapuram'),
      geri(DEMO_GERIATRIC_NAMES[11], 'self_help_group', '9447090111', 'Day care and memory activities for people living with dementia.', 'Vellayambalam'),
    ],
  });
  tally.add('Elder-care directory listings', DEMO_GERIATRIC_NAMES.length);

  const news = (title: string, excerpt: string, body: string, audience: 'everyone' | 'all_caregivers' | 'all_volunteers' | 'all_elders', status: 'published' | 'scheduled' | 'draft', daysAgo: number) => ({
    title, excerpt, bodyHtml: body, audience, status, createdById: p.adminId, createdAt: at(-daysAgo - 1),
    ...(status === 'published' ? { publishedAt: at(-daysAgo) } : status === 'scheduled' ? { scheduledFor: at(3) } : {}),
  });
  await prisma.newsletter.createMany({
    data: [
      news(DEMO_NEWSLETTER_TITLES[0], 'How your community and your family stay connected.', '<p>Kowdiar Gardens is the first residents’ association on EC in Thiruvananthapuram. Neighbours can now share notices, events and help requests, and families abroad can follow their parents’ health and safety from wherever they are.</p><p>Do say hello to your neighbours in the Local Directory.</p>', 'everyone', 'published', 90),
      news(DEMO_NEWSLETTER_TITLES[1], 'Simple habits that keep elders safe.', '<p>The dry spells can be harsh on older people. Keep a water bottle within reach, add a pinch of salt and lemon to water if your doctor agrees, and avoid going out between noon and 4 PM.</p><p>Family members: a quick phone call at lunchtime goes a long way.</p>', 'everyone', 'published', 66),
      news(DEMO_NEWSLETTER_TITLES[2], 'A gentle monthly nudge, never an automatic order.', '<p>EC now suggests a monthly refill for medicines you buy regularly. Nothing is ordered until you or your family approve it.</p><p>Find it under Orders > Refill reminders.</p>', 'all_caregivers', 'published', 34),
      news(DEMO_NEWSLETTER_TITLES[3], 'Thank you for a wonderful season.', '<p>Onam was celebrated in homes across the community, with pookalams on every road and families abroad joining the sadya by video. Our volunteers helped dozens of elders with water, medicines and company. Thank you.</p>', 'everyone', 'published', 40),
      news(DEMO_NEWSLETTER_TITLES[5], 'Stay part of the celebrations from far away.', '<p>For families abroad: you can watch the Navaratri pooja, send a message to your parents from the family dashboard and book a driver or a companion for Vidyarambham mornings.</p>', 'all_caregivers', 'scheduled', 0),
      news(DEMO_NEWSLETTER_TITLES[4], 'Draft — not yet sent.', '<p>We are planning to recognise verified community volunteers with training and a badge.</p>', 'all_volunteers', 'draft', 0),
    ],
  });
  tally.add('Newsletters', 6);
}
