import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import type { DemoPeople } from './accounts';
import type { DemoCommunity } from './community';
import type { DemoProviders } from './providers';
import { at, hoursAgo, newId, type Tally } from './helpers';

/** Titles / names of the platform-wide content the demo adds, so "remove demo data" can find it again. */
export const DEMO_NEWSLETTER_TITLES = [
  'Staying cool and hydrated this season',
  'Introducing medicine refill reminders',
  'Draft: Community volunteers programme',
];
export const DEMO_GERIATRIC_NAMES = [
  'Sukhi Seniors Self-Help Group', 'Anugraha Palliative Care', 'Vishranti Elder Care Trust', 'Nirmaya Physiotherapy Centre',
  'Ananda Wellness Massage', 'Shanti Yoga for Seniors', 'Prashanti Meditation Hall', 'Doctor at Door Home Visits',
  'Ayush Ayurveda Clinic', 'Sanjeevani Multispeciality Hospital', 'Rapid Ambulance Service', 'Smruti Dementia Day Care',
];

const razorpayDemo = (kind: string) => `${kind}_demo_${newId().replace(/-/g, '').slice(0, 14)}`;
const feeSplit = (total: number) => {
  const fee = Math.round(total * 0.05 * 100) / 100;
  return { platformFeeAmount: fee, netAmountForProvider: total - fee };
};

/** Doctors, rides, advisory, property care, orders, rentals and the platform directories. */
export async function buildServices(p: DemoPeople, prov: DemoProviders, comm: DemoCommunity, tally: Tally, healthMeds: Array<{ id: string; name: string }>) {
  const { elderId, familyId } = p;
  const nId = comm.neighborhoodId;
  const addr = 'A-204, Sunrise Residency, 12th Cross, Indiranagar, Bengaluru 560038';
  const ratings: Prisma.ProviderRatingCreateManyInput[] = [];

  // ─── Doctors, slots and bookings ─────────────────────────────────────────
  const doctors = [
    { id: newId(), name: 'Dr. Anita Rao', clinicName: 'Rao Family Clinic', specialty: 'General medicine and geriatrics', qualifications: 'MBBS, MD (Medicine), PG Diploma in Geriatric Medicine', background: 'Over fifteen years caring for senior citizens. Offers home visits for those who cannot travel.', locality: 'Indiranagar', lat: 12.9784, lng: 77.6408, phone: '9000000201', fee: 600, providerId: prov.id.doctor, addedById: p.support.doctor },
    { id: newId(), name: 'Dr. Suresh Kamath', clinicName: 'Kamath Bone & Joint Clinic', specialty: 'Orthopaedics', qualifications: 'MBBS, MS (Orthopaedics)', background: 'Specialises in knee and hip problems in the elderly, including non-surgical management.', locality: 'Domlur', lat: 12.9610, lng: 77.6387, phone: '9000000302', fee: 800, providerId: null, addedById: p.neighbour.meera },
    { id: newId(), name: 'Dr. Fatima Sheikh', clinicName: 'Wellness Physio Centre', specialty: 'Physiotherapy', qualifications: 'BPT, MPT (Neurology)', background: 'Helps seniors regain balance and strength after illness or surgery.', locality: 'Indiranagar', lat: 12.9701, lng: 77.6401, phone: '9000000303', fee: 500, providerId: null, addedById: p.neighbour.meera },
  ];
  await prisma.localDoctor.createMany({
    data: doctors.map((d) => ({
      id: d.id, neighborhoodId: nId, name: d.name, clinicName: d.clinicName, specialty: d.specialty, qualifications: d.qualifications, background: d.background,
      locality: d.locality, lat: d.lat, lng: d.lng, mapsLink: `https://maps.google.com/?q=${d.lat},${d.lng}`, phone: d.phone, consultationFee: d.fee, providerId: d.providerId, addedById: d.addedById, isActive: true,
    })),
  });

  const slots: Array<{ id: string; doctorId: string; startsAt: Date; isBooked: boolean }> = [];
  const slotAt = (doctorId: string, day: number, hhmm: string, booked = false) => {
    const s = { id: newId(), doctorId, startsAt: at(day, hhmm), isBooked: booked };
    slots.push(s);
    return s;
  };
  // Open slots for the coming week.
  for (const d of doctors) for (let day = 1; day <= 7; day++) for (const t of ['10:00', '10:30', '11:00', '17:00', '17:30']) slotAt(d.id, day, t);
  // Booked slots (past and upcoming).
  const bPast = slotAt(doctors[0].id, -12, '11:00', true);
  const bPaid = slotAt(doctors[0].id, 1, '11:30', true);
  const bConfirmed = slotAt(doctors[0].id, 2, '10:00', true);
  const bPending = slotAt(doctors[1].id, 4, '17:00', true);
  await prisma.doctorSlot.createMany({ data: slots });

  const docBookings = [
    { id: newId(), doctorId: doctors[0].id, slotId: bPast.id, status: 'closed' as const, amount: 600, razorpayPaymentId: razorpayDemo('pay'), razorpayOrderId: razorpayDemo('order') },
    { id: newId(), doctorId: doctors[0].id, slotId: bPaid.id, status: 'paid' as const, amount: 600, razorpayPaymentId: razorpayDemo('pay'), razorpayOrderId: razorpayDemo('order') },
    { id: newId(), doctorId: doctors[0].id, slotId: bConfirmed.id, status: 'confirmed' as const, amount: 600 },
    { id: newId(), doctorId: doctors[1].id, slotId: bPending.id, status: 'pending_confirmation' as const, amount: 800 },
  ];
  await prisma.doctorBooking.createMany({ data: docBookings.map((b) => ({ ...b, elderUserId: elderId, bookedById: familyId })) });
  ratings.push({ providerId: prov.id.doctor, raterUserId: familyId, stars: 5, comment: 'Dr. Rao was patient and explained everything to Amma in simple words.', doctorBookingId: docBookings[0].id });
  tally.add('Doctors, slots and bookings', doctors.length + slots.length + docBookings.length);

  // ─── Auto and taxi ───────────────────────────────────────────────────────
  const drivers = [
    { id: newId(), name: 'Ravi Kumar', phone: '9000000202', whatsapp: '9000000202', vehicleNumber: 'KA 01 AB 1234', serviceArea: 'Indiranagar, Ulsoor, Koramangala', perKmRate: 18, perMinWaitRate: 2, providerId: prov.id.auto, sortOrder: 1 },
    { id: newId(), name: 'Mohammed Ismail', phone: '9000000601', whatsapp: '9000000601', vehicleNumber: 'KA 03 CD 5678', serviceArea: 'Indiranagar, Domlur', perKmRate: null, perMinWaitRate: null, providerId: null, sortOrder: 2 },
    { id: newId(), name: 'Venkatesh', phone: '9000000602', whatsapp: null, vehicleNumber: 'KA 05 EF 9012', serviceArea: 'HAL, CV Raman Nagar', perKmRate: 20, perMinWaitRate: 2, providerId: null, sortOrder: 3 },
  ];
  await prisma.autoDriver.createMany({ data: drivers.map((d) => ({ ...d, neighborhoodId: nId })) });
  await prisma.autoRateCard.create({ data: { neighborhoodId: nId, perKmRate: 19, perMinWaitRate: 2 } });
  const autoBookings = [
    { id: newId(), driverId: drivers[0].id, pickupAddress: addr, pickupLat: 12.9784, pickupLng: 77.6408, dropAddress: 'Manipal Hospital, Old Airport Road', dropLat: 12.9591, dropLng: 77.6489, fareAmount: 180, status: 'closed' as const, razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-9), createdAt: at(-9, '08:00') },
    { id: newId(), driverId: drivers[0].id, pickupAddress: addr, pickupLat: 12.9784, pickupLng: 77.6408, dropAddress: 'Lotus Eye Clinic, Indiranagar', dropLat: 12.9719, dropLng: 77.6412, fareAmount: 90, status: 'confirmed' as const, razorpayOrderId: null, razorpayPaymentId: null, paidAt: null, createdAt: hoursAgo(6) },
    { id: newId(), driverId: drivers[1].id, pickupAddress: addr, pickupLat: 12.9784, pickupLng: 77.6408, dropAddress: 'Lalbagh Botanical Garden, Lalbagh Main Gate', dropLat: 12.9507, dropLng: 77.5848, fareAmount: 320, status: 'pending_confirmation' as const, razorpayOrderId: null, razorpayPaymentId: null, paidAt: null, createdAt: hoursAgo(2) },
    { id: newId(), driverId: drivers[2].id, pickupAddress: addr, pickupLat: 12.9784, pickupLng: 77.6408, dropAddress: 'Kempegowda Airport, Terminal 1', dropLat: 13.1986, dropLng: 77.7066, fareAmount: 1450, status: 'cancelled' as const, razorpayOrderId: null, razorpayPaymentId: null, paidAt: null, createdAt: at(-22) },
  ];
  await prisma.autoBooking.createMany({ data: autoBookings.map((b) => ({ ...b, elderUserId: elderId, bookedById: familyId })) });
  ratings.push({ providerId: prov.id.auto, raterUserId: familyId, stars: 5, comment: 'Ravi helped Amma into the auto and waited at the hospital. Very kind.', autoBookingId: autoBookings[0].id });
  tally.add('Auto drivers and rides', drivers.length + 1 + autoBookings.length);

  // ─── Advisory ────────────────────────────────────────────────────────────
  const willId = newId();
  const insId = newId();
  const rmId = newId();
  await prisma.consultationRequest.createMany({
    data: [
      { id: willId, elderUserId: elderId, requestedById: familyId, category: 'legal_will', requirementDetails: { documentType: 'Registered Will', city: 'Bengaluru' }, notes: 'Mother wants to leave the flat to both children equally and some jewellery to the granddaughters.', assignedExpertId: prov.expert.legal_will, status: 'in_progress', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-9), createdAt: at(-10) },
      { id: insId, elderUserId: elderId, requestedById: familyId, category: 'senior_insurance', requirementDetails: { insuranceType: 'Senior health top-up', city: 'Bengaluru' }, notes: 'Existing conditions: blood pressure and diabetes.', assignedExpertId: prov.expert.senior_insurance, status: 'closed', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-40), createdAt: at(-42) },
      { id: rmId, elderUserId: elderId, requestedById: familyId, category: 'reverse_mortgage', requirementDetails: { propertyValue: '1.8 crore', city: 'Bengaluru' }, notes: 'Just exploring - would like to understand the risks first.', assignedExpertId: null, status: 'submitted', createdAt: hoursAgo(30) },
    ],
  });
  await prisma.vaultDocument.createMany({
    data: [
      { consultationRequestId: willId, uploadedById: familyId, fileName: 'Will - documents checklist.pdf', filePath: '/demo/docs/will-checklist.pdf', fileType: 'application/pdf' },
      { consultationRequestId: insId, uploadedById: p.support.insurance, fileName: 'Plan comparison.pdf', filePath: '/demo/docs/policy-comparison.pdf', fileType: 'application/pdf' },
    ],
  });
  ratings.push({ providerId: prov.id.insurance, raterUserId: familyId, stars: 5, comment: 'Pooja compared five plans and was honest about waiting periods.', consultationId: insId });
  tally.add('Advisory consultations and vault documents', 5);

  // ─── Property care ───────────────────────────────────────────────────────
  const subId = newId();
  await prisma.propertySubscription.create({
    data: { id: subId, elderUserId: elderId, subscribedById: familyId, providerId: prov.id.property, frequency: 'quarterly', status: 'active', fee: 4200, createdAt: at(-80) },
  });
  const insp1 = newId();
  const insp2 = newId();
  await prisma.propertyInspection.createMany({
    data: [
      { id: insp1, subscriptionId: subId, submittedById: p.support.property, inspectedAt: at(-70, '11:00'), plumbingStatus: 'pass', electricalStatus: 'pass', structuralStatus: 'pass', notes: 'First visit. All fittings working, no leaks, locks and windows secure. Water meter noted.', mediaPaths: ['/demo/inspection/electrical.svg'], createdAt: at(-70, '12:00') },
      { id: insp2, subscriptionId: subId, submittedById: p.support.property, inspectedAt: at(-10, '11:00'), plumbingStatus: 'fail', electricalStatus: 'pass', structuralStatus: 'needs_attention', notes: 'Kitchen tap leaking at the joint and damp patch starting on the bedroom wall. One MCB in the distribution board is loose.', mediaPaths: ['/demo/inspection/plumbing.svg', '/demo/inspection/wall.svg', '/demo/inspection/electrical.svg'], createdAt: at(-10, '13:00') },
    ],
  });
  const est = { tap: newId(), wall: newId(), mcb: newId() };
  await prisma.repairEstimate.createMany({
    data: [
      { id: est.tap, inspectionId: insp2, itemDescription: 'Replace kitchen tap and fix leaking joint', estimatedCost: 2800, isApproved: true },
      { id: est.wall, inspectionId: insp2, itemDescription: 'Waterproofing treatment for bedroom wall seepage', estimatedCost: 9500, isApproved: false },
      { id: est.mcb, inspectionId: insp2, itemDescription: 'Replace loose MCB in distribution board', estimatedCost: 1200, isApproved: true },
    ],
  });
  const invTap = newId();
  await prisma.propertyInvoice.createMany({
    data: [
      { id: invTap, repairEstimateId: est.tap, amount: 2800, status: 'closed', razorpayOrderId: razorpayDemo('order'), razorpayPaymentId: razorpayDemo('pay'), paidAt: at(-7), createdAt: at(-8) },
      { id: newId(), repairEstimateId: est.mcb, amount: 1200, status: 'pending', createdAt: at(-8) },
    ],
  });
  ratings.push({ providerId: prov.id.property, raterUserId: familyId, stars: 4, comment: 'Good report with photos. Repair done within two days.', propertyInvoiceId: invTap });
  tally.add('Property care (subscription, inspections, estimates, invoices)', 8);

  // ─── Orders (pharmacy, nursing, grocery) ─────────────────────────────────
  type Line = [catalog: 'pharmacy' | 'nursing' | 'grocery', index: number, qty: number];
  interface OrderSeed {
    provider: 'pharmacy' | 'nursing' | 'grocery';
    status: 'pending' | 'paid' | 'confirmed' | 'delivered' | 'closed' | 'cancelled';
    by: 'elder' | 'family';
    when: Date;
    lines: Line[];
    cod?: boolean;
    rating?: { stars: number; comment: string };
  }
  const seeds: OrderSeed[] = [
    { provider: 'pharmacy', status: 'closed', by: 'family', when: at(-48, '11:00'), lines: [['pharmacy', 6, 1], ['pharmacy', 9, 1]], rating: { stars: 5, comment: 'Delivered the same afternoon. The staff set up the BP monitor for Amma.' } },
    { provider: 'pharmacy', status: 'closed', by: 'elder', when: at(-40, '09:30'), cod: true, lines: [['pharmacy', 0, 2], ['pharmacy', 1, 1]], rating: { stars: 4, comment: 'On time. Paid cash on delivery.' } },
    { provider: 'pharmacy', status: 'closed', by: 'family', when: at(-33, '18:00'), lines: [['pharmacy', 3, 2], ['pharmacy', 4, 1], ['pharmacy', 14, 2]], rating: { stars: 5, comment: 'Thank you for the monthly reminder. Very convenient.' } },
    { provider: 'pharmacy', status: 'closed', by: 'family', when: at(-21, '10:15'), lines: [['pharmacy', 7, 1], ['pharmacy', 1, 2]], rating: { stars: 4, comment: 'The glucometer strips were near expiry - replaced promptly when we called.' } },
    { provider: 'pharmacy', status: 'closed', by: 'family', when: at(-14, '16:40'), lines: [['pharmacy', 10, 2], ['pharmacy', 11, 1], ['pharmacy', 13, 1]], rating: { stars: 5, comment: 'Discreet packing and quick delivery.' } },
    { provider: 'pharmacy', status: 'delivered', by: 'family', when: at(-3, '12:20'), lines: [['pharmacy', 3, 1], ['pharmacy', 2, 1], ['pharmacy', 0, 2]] },
    { provider: 'pharmacy', status: 'delivered', by: 'elder', when: at(-1, '17:10'), cod: true, lines: [['pharmacy', 5, 1], ['pharmacy', 1, 1]] },
    { provider: 'pharmacy', status: 'confirmed', by: 'family', when: hoursAgo(5), lines: [['pharmacy', 12, 1], ['pharmacy', 8, 1]] },
    { provider: 'pharmacy', status: 'paid', by: 'family', when: hoursAgo(2), lines: [['pharmacy', 4, 2]] },
    { provider: 'pharmacy', status: 'pending', by: 'elder', when: hoursAgo(1), lines: [['pharmacy', 2, 1], ['pharmacy', 0, 1]] },
    { provider: 'pharmacy', status: 'pending', by: 'family', when: hoursAgo(5), lines: [['pharmacy', 8, 1]] },
    { provider: 'pharmacy', status: 'cancelled', by: 'family', when: at(-25, '14:00'), lines: [['pharmacy', 15, 1]] },
    { provider: 'nursing', status: 'closed', by: 'family', when: at(-18, '09:00'), lines: [['nursing', 2, 1]], rating: { stars: 5, comment: 'The nurse was gentle and professional with Amma.' } },
    { provider: 'nursing', status: 'confirmed', by: 'family', when: at(-1, '19:00'), lines: [['nursing', 1, 3]] },
    { provider: 'grocery', status: 'delivered', by: 'elder', when: at(-2, '08:00'), lines: [['grocery', 0, 1], ['grocery', 2, 2], ['grocery', 3, 1]] },
    { provider: 'grocery', status: 'closed', by: 'family', when: at(-10, '08:30'), lines: [['grocery', 1, 1], ['grocery', 0, 1]], rating: { stars: 4, comment: 'Fresh fruit, packed in small bags that Amma can carry.' } },
  ];
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  const orderIds: string[] = [];
  seeds.forEach((s) => {
    const orderId = newId();
    orderIds.push(orderId);
    const lines = s.lines.map(([cat, idx, qty]) => ({ item: prov.catalog[cat][idx], qty }));
    const total = lines.reduce((sum, l) => sum + l.item.price * l.qty, 0);
    const isPaid = s.status !== 'pending' && s.status !== 'cancelled' && !s.cod;
    orderRows.push({
      id: orderId, elderUserId: elderId, placedByUserId: s.by === 'elder' ? elderId : familyId, providerId: prov.id[s.provider],
      status: s.status, paymentMethod: s.cod ? 'cod' : 'razorpay', totalAmount: total, deliveryAddress: addr,
      razorpayOrderId: isPaid || s.status === 'pending' ? razorpayDemo('order') : null,
      razorpayPaymentId: isPaid ? razorpayDemo('pay') : null, paidAt: isPaid ? s.when : null,
      ...(isPaid ? feeSplit(total) : {}), createdAt: s.when,
    });
    for (const l of lines) itemRows.push({ orderId, catalogItemId: l.item.id, name: l.item.name, price: l.item.price, quantity: l.qty });
    if (s.rating) ratings.push({ providerId: prov.id[s.provider], raterUserId: s.by === 'elder' ? elderId : familyId, stars: s.rating.stars, comment: s.rating.comment, orderId });
  });
  await prisma.order.createMany({ data: orderRows });
  await prisma.orderItem.createMany({ data: itemRows });
  tally.add('Orders and order items', orderRows.length + itemRows.length);

  // Monthly refill reminders (pharmacy auto-reorder)
  const calciumMed = healthMeds.find((m) => m.name.startsWith('Calcium'));
  const calciumItem = prov.catalog.pharmacy[3];
  const multiItem = prov.catalog.pharmacy[4];
  const tplCalcium = newId();
  const tplMulti = newId();
  await prisma.recurringOrderTemplate.createMany({
    data: [
      { id: tplCalcium, elderUserId: elderId, providerId: prov.id.pharmacy, catalogItemId: calciumItem.id, medicationId: calciumMed?.id ?? null, unitsPerMonth: 1, isActive: true },
      { id: tplMulti, elderUserId: elderId, providerId: prov.id.pharmacy, catalogItemId: multiItem.id, medicationId: null, unitsPerMonth: 1, isActive: true },
    ],
  });
  await prisma.recurringOrderSuggestion.createMany({
    data: [
      { templateId: tplCalcium, suggestedAt: at(-4), status: 'approved', orderId: orderIds[5] },
      { templateId: tplCalcium, suggestedAt: hoursAgo(20), status: 'pendingApproval' },
      { templateId: tplMulti, suggestedAt: hoursAgo(20), status: 'pendingApproval' },
    ],
  });
  tally.add('Monthly refill reminders', 5);

  await prisma.providerRating.createMany({ data: ratings });
  tally.add('Ratings and reviews', ratings.length);

  // ─── Rentals (platform-wide) ─────────────────────────────────────────────
  const rentals = [
    { id: newId(), postedById: p.neighbour.ramesh, title: 'Ground-floor 2BHK near Cubbon Park', listingType: 'entire_house' as const, monthlyRent: 32000, securityDeposit: 200000, address: '18, Kasturba Road', city: 'Bengaluru', description: 'Bright flat with a wide entrance, wheelchair-friendly bathrooms and a caretaker on site.', houseRules: 'No smoking. Pets with prior approval.', wheelchairRamp: true, grabBars: true, noStepEntry: true, groundFloor: true, imagePath: '/demo/rentals/ground-floor.svg', contactPhone: '9000000102', status: 'active' as const },
    { id: newId(), postedById: p.neighbour.sunita, title: 'Sunny room with ramp in a senior-friendly home', listingType: 'room' as const, monthlyRent: 14000, securityDeposit: 42000, address: 'Defence Colony, Indiranagar', city: 'Bengaluru', description: 'Private room with attached bath in a quiet home. Meals available.', houseRules: 'Vegetarian kitchen.', wheelchairRamp: true, grabBars: true, noStepEntry: true, groundFloor: true, imagePath: '/demo/rentals/room.svg', contactPhone: '9000000104', status: 'active' as const },
    { id: newId(), postedById: p.neighbour.anand, title: 'Independent house with garden, Domlur', listingType: 'entire_house' as const, monthlyRent: 45000, securityDeposit: 300000, address: '5th Cross, Domlur', city: 'Bengaluru', description: 'Three bedrooms, small garden and a covered porch. Step-free entrance.', houseRules: null, wheelchairRamp: false, grabBars: false, noStepEntry: true, groundFloor: true, imagePath: '/demo/rentals/villa.svg', contactPhone: '9000000108', status: 'in_negotiation' as const },
    { id: newId(), postedById: p.neighbour.farida, title: 'Single room for a live-in caregiver', listingType: 'room' as const, monthlyRent: 9000, securityDeposit: 18000, address: 'Near Indiranagar metro', city: 'Bengaluru', description: 'Simple furnished room close to the metro.', houseRules: null, wheelchairRamp: false, grabBars: false, noStepEntry: false, groundFloor: false, imagePath: null, contactPhone: '9000000106', status: 'rented' as const },
  ];
  await prisma.rentalListing.createMany({ data: rentals.map((r) => ({ ...r, neighborhoodId: nId })) });
  await prisma.rentalInquiry.createMany({
    data: [
      { listingId: rentals[0].id, inquirerId: familyId, message: 'Looking for a ground-floor flat for my mother’s friend visiting from Mysuru. Can we visit this weekend?', visitDate: at(5, '11:00'), status: 'scheduled' },
      { listingId: rentals[1].id, inquirerId: familyId, message: 'Is the room available from next month?', status: 'open' },
    ],
  });
  tally.add('Rentals and inquiries', rentals.length + 2);

  // ─── Platform directories and content ────────────────────────────────────
  const geri = (name: string, category: 'self_help_group' | 'ngo' | 'palliative_care' | 'physiotherapy' | 'massage' | 'yoga' | 'meditation' | 'doctor_home_visit' | 'ayurveda' | 'hospital' | 'ambulance', phone: string, description: string, address: string) =>
    ({ name, category, phone, description, address, city: 'Bengaluru', pincode: '560038', isActive: true, verified: true, addedById: p.adminId });
  await prisma.geriatricCareListing.createMany({
    data: [
      geri(DEMO_GERIATRIC_NAMES[0], 'self_help_group', '9000000701', 'A peer group of senior women who meet twice a week for crafts, savings and mutual support.', 'Indiranagar'),
      geri(DEMO_GERIATRIC_NAMES[1], 'palliative_care', '9000000702', 'Home-based palliative and end-of-life care with a trained team and counsellors.', 'HAL 2nd Stage'),
      geri(DEMO_GERIATRIC_NAMES[2], 'ngo', '9000000703', 'A trust supporting elders without family: meals, medicines and companionship.', 'Domlur'),
      geri(DEMO_GERIATRIC_NAMES[3], 'physiotherapy', '9000000704', 'Balance training, post-fracture rehabilitation and home visits.', 'CV Raman Nagar'),
      geri(DEMO_GERIATRIC_NAMES[4], 'massage', '9000000705', 'Gentle therapeutic massage by trained women therapists, at home or in the centre.', 'Indiranagar'),
      geri(DEMO_GERIATRIC_NAMES[5], 'yoga', '9000000706', 'Chair yoga and breathing classes designed for seniors.', 'Indiranagar'),
      geri(DEMO_GERIATRIC_NAMES[6], 'meditation', '9000000707', 'Guided meditation every morning in a quiet hall.', 'Ulsoor'),
      geri(DEMO_GERIATRIC_NAMES[7], 'doctor_home_visit', '9000000708', 'Doctors who visit homes for check-ups, injections and sample collection.', 'Bengaluru East'),
      geri(DEMO_GERIATRIC_NAMES[8], 'ayurveda', '9000000709', 'Ayurvedic consultation and Panchakarma for joint and sleep problems.', 'Indiranagar'),
      geri(DEMO_GERIATRIC_NAMES[9], 'hospital', '08022221111', 'Multispeciality hospital with a dedicated geriatric department.', 'Old Airport Road'),
      geri(DEMO_GERIATRIC_NAMES[10], 'ambulance', '9000000710', 'Cardiac and basic-life-support ambulances, available 24 hours.', 'Bengaluru'),
      geri(DEMO_GERIATRIC_NAMES[11], 'self_help_group', '9000000711', 'Day care and memory activities for people living with dementia.', 'Domlur'),
    ],
  });
  tally.add('Elder-care directory listings', DEMO_GERIATRIC_NAMES.length);

  await prisma.newsletter.createMany({
    data: [
      { title: DEMO_NEWSLETTER_TITLES[0], bodyHtml: '<p>Summer brings extra risk of dehydration for older people. Keep a water bottle within reach, add a pinch of salt and lemon to water if your doctor agrees, and avoid going out between noon and 4 PM.</p><p>Family members: a quick phone call at lunchtime goes a long way.</p>', excerpt: 'Simple habits that keep elders safe in the heat.', audience: 'everyone', status: 'published', publishedAt: at(-6), createdById: p.adminId },
      { title: DEMO_NEWSLETTER_TITLES[1], bodyHtml: '<p>EC now suggests a monthly refill for medicines you buy regularly. Nothing is ordered until you or your family approve it.</p><p>Find it under Orders > Refill reminders.</p>', excerpt: 'A gentle monthly nudge, never an automatic order.', audience: 'all_caregivers', status: 'published', publishedAt: at(-2), createdById: p.adminId },
      { title: DEMO_NEWSLETTER_TITLES[2], bodyHtml: '<p>We are planning to recognise verified community volunteers with training and a badge.</p>', excerpt: 'Draft - not yet sent.', audience: 'all_volunteers', status: 'draft', createdById: p.adminId },
    ],
  });
  tally.add('Newsletters', 3);
}
