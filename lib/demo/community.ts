import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { houseKey } from '@/lib/house';
import type { DemoPeople } from './accounts';
import type { DemoProviders } from './providers';
import {
  at, billingPeriod, DEMO_COMMUNITY_CODE, DEMO_COMMUNITY_NAME, DEMO_EMAIL_DOMAIN, dob, hoursAgo, minutesAgo, NEIGHBOURS, newId, type Tally,
} from './helpers';

export interface DemoCommunity {
  neighborhoodId: string;
  /** NeighborhoodMember id by user id. */
  memberId: Record<string, string>;
}

const ELDER_FLAT = 'A-204';
const FAMILY_FLAT = 'B-110';

/** The Sunrise Residency community the elder and family live in, with every community module filled. */
export async function buildCommunity(p: DemoPeople, prov: DemoProviders, tally: Tally): Promise<DemoCommunity> {
  const { elderId, familyId } = p;
  const u = p.neighbour;
  const nId = newId();

  // Make the demo community each account's primary one, even if they already belong to another.
  const earliest = await prisma.neighborhoodMember.findMany({
    where: { userId: { in: [elderId, familyId] }, status: 'approved' },
    orderBy: { createdAt: 'asc' },
    take: 1,
    select: { createdAt: true },
  });
  const joinedFirst = earliest[0] ? new Date(earliest[0].createdAt.getTime() - 86_400_000) : at(-130);

  await prisma.neighborhood.create({
    data: {
      id: nId,
      name: DEMO_COMMUNITY_NAME,
      city: 'Bengaluru',
      pincode: '560038',
      description: 'A friendly apartment community of 120 families in Indiranagar, with a large senior population and an active residents’ committee.',
      joinCode: DEMO_COMMUNITY_CODE,
    },
  });

  // ─── Members ─────────────────────────────────────────────────────────────
  const imranId = newId();
  await prisma.user.create({
    data: { id: imranId, name: 'Imran Sheikh', email: `imran@${DEMO_EMAIL_DOMAIN}`, phone: '9000000114', role: 'caregiver', dateOfBirth: dob(1988, 4, 3), city: 'Bengaluru', passwordHash: null },
  });

  const memberId: Record<string, string> = {};
  const members: Array<{ userId: string; flat: string; role: 'member' | 'committee' | 'admin'; joined: Date; status?: 'approved' | 'pending' }> = [
    { userId: elderId, flat: ELDER_FLAT, role: 'member', joined: joinedFirst },
    { userId: familyId, flat: FAMILY_FLAT, role: 'admin', joined: joinedFirst },
    ...NEIGHBOURS.map((n, i) => ({ userId: u[n.key], flat: n.flat, role: n.communityRole ?? ('member' as const), joined: at(-125 + i * 6) })),
    { userId: imranId, flat: 'D-402', role: 'member', joined: hoursAgo(20), status: 'pending' },
  ];
  await prisma.neighborhoodMember.createMany({
    data: members.map((m) => {
      const id = newId();
      memberId[m.userId] = id;
      return {
        id, neighborhoodId: nId, userId: m.userId, role: m.role, flatNumber: m.flat, isBillingContact: true,
        showInDirectory: true, status: m.status ?? 'approved', approvedAt: m.status === 'pending' ? null : m.joined,
        approvedById: m.status === 'pending' ? null : familyId, createdAt: m.joined,
      };
    }),
  });
  tally.add('Community members', members.length);


  // ─── Community registration (how this locality joined EC) ────────────────
  await prisma.communityApplication.createMany({
    data: [
      {
        placeName: DEMO_COMMUNITY_NAME, applicantType: 'Residents’ association', city: 'Bengaluru', pincode: '560038', numberOfFamilies: 120,
        applicantName: 'Meera Nair', applicantPhone: '9000000101', applicantEmail: `meera@${DEMO_EMAIL_DOMAIN}`, applicantDesignation: 'Secretary',
        status: 'approved', localityCode: 'EC-560038-SUN1', neighborhoodId: nId, reviewedById: p.adminId, reviewedAt: at(-128),
      },
      {
        placeName: 'Palm Grove Apartments, Whitefield', applicantType: 'Residents’ association', city: 'Bengaluru', pincode: '560066', numberOfFamilies: 86,
        applicantName: 'Harish Rao', applicantPhone: '9000000115', applicantEmail: `harish@${DEMO_EMAIL_DOMAIN}`, applicantDesignation: 'President', status: 'pending',
      },
    ],
  });
  tally.add('Community applications', 2);

  // ─── Notices ─────────────────────────────────────────────────────────────
  await prisma.notice.createMany({
    data: [
      { neighborhoodId: nId, title: 'Water tank cleaning this Saturday', body: 'The overhead and sump tanks will be cleaned from 9 AM to 3 PM. Water supply will be off. Please store drinking water in advance. Volunteers will help senior residents carry water on request - ask the security desk.', pinned: true, createdById: u.meera, createdAt: hoursAgo(30) },
      { neighborhoodId: nId, title: 'Diwali get-together at the clubhouse', body: 'Join us for diyas, sweets and music on the evening of the festival. Children’s rangoli competition at 6 PM. Everyone is welcome - please RSVP in the Events section.', pinned: false, createdById: u.rekha, createdAt: hoursAgo(60) },
      { neighborhoodId: nId, title: 'Block B lift will be serviced', body: 'The Block B lift will be out of service on Tuesday between 10 AM and 1 PM for controller replacement. Please use Block A or C lifts. Residents who need assistance can call the security desk.', pinned: false, createdById: u.ramesh, createdAt: hoursAgo(100) },
      { neighborhoodId: nId, title: 'Maintenance due by the 10th', body: 'A gentle reminder that monthly maintenance is due by the 10th. You can now pay online from Community > Fees. Receipts are emailed automatically.', pinned: false, createdById: u.ramesh, createdAt: hoursAgo(150) },
      { neighborhoodId: nId, title: 'Free health check-up camp for senior citizens', body: 'A free camp with BP, sugar, eye and bone density checks for residents over 60 will be held at the clubhouse. Dr. Anita Rao and her team will attend. Please carry your previous reports.', pinned: false, createdById: familyId, createdAt: hoursAgo(220) },
      { neighborhoodId: nId, title: 'New security agency from the 1st', body: 'We are moving to a new security agency with trained guards and a visitor app. Please keep your vehicle stickers ready for re-verification.', pinned: false, createdById: u.meera, createdAt: hoursAgo(400) },
    ],
  });
  tally.add('Announcements', 6);

  // ─── Events and RSVPs ────────────────────────────────────────────────────
  const events = [
    { key: 'bhajan', title: 'Bhajan Sandhya', description: 'An evening of devotional songs led by the Bhajan Mandali. Tea and prasad afterwards.', location: 'Clubhouse', category: 'cultural' as const, startsAt: at(2, '18:30'), endsAt: at(2, '20:00'), by: u.sunita },
    { key: 'movie', title: 'Classic movie evening', description: 'A screening of a beloved black-and-white classic with subtitles. Comfortable seating for seniors.', location: 'Clubhouse hall', category: 'movie' as const, startsAt: at(4, '18:00'), endsAt: at(4, '21:00'), by: u.rekha },
    { key: 'diwali', title: 'Diwali get-together', description: 'Diyas, sweets, rangoli and music. Bring a dish to share if you like.', location: 'Clubhouse lawn', category: 'social' as const, startsAt: at(6, '18:30'), endsAt: at(6, '21:30'), by: u.rekha },
    { key: 'coffee', title: 'Terrace coffee morning', description: 'Meet your neighbours over filter coffee and idli. A relaxed start to the weekend.', location: 'Block A terrace', category: 'social' as const, startsAt: at(8, '08:30'), endsAt: at(8, '10:00'), by: u.meera },
    { key: 'camp', title: 'Senior citizens health check-up camp', description: 'Free BP, sugar, eye and bone density checks with Dr. Anita Rao. Registration at the door.', location: 'Clubhouse', category: 'other' as const, startsAt: at(10, '09:00'), endsAt: at(10, '13:00'), by: familyId },
    { key: 'nandi', title: 'Day trip to Nandi Hills', description: 'A comfortable day out by tempo traveller with a doctor-approved easy walk. Breakfast and lunch included.', location: 'Pick-up at main gate', category: 'local_tour' as const, startsAt: at(16, '06:30'), endsAt: at(16, '17:30'), by: u.nandini },
    { key: 'flag', title: 'Independence Day flag hoisting', description: 'Flag hoisting followed by sweets and patriotic songs by the children.', location: 'Main lawn', category: 'cultural' as const, startsAt: at(-55, '08:00'), endsAt: at(-55, '10:00'), by: u.meera },
    { key: 'agm', title: 'Annual General Meeting', description: 'Accounts for the year, lift modernisation, security and election of the committee.', location: 'Clubhouse', category: 'other' as const, startsAt: at(-116, '10:30'), endsAt: at(-116, '12:40'), by: u.ramesh },
  ].map((e) => ({ ...e, id: newId() }));
  await prisma.communityEvent.createMany({
    data: events.map((e) => ({ id: e.id, neighborhoodId: nId, title: e.title, description: e.description, location: e.location, category: e.category, startsAt: e.startsAt, endsAt: e.endsAt, createdById: e.by })),
  });
  const ev = (k: string) => events.find((e) => e.key === k)!.id;
  const rsvp = (eventId: string, userId: string, status: 'going' | 'maybe' | 'not_going') => ({ eventId, userId, status });
  await prisma.communityEventRsvp.createMany({
    data: [
      rsvp(ev('bhajan'), elderId, 'going'), rsvp(ev('bhajan'), u.sunita, 'going'), rsvp(ev('bhajan'), u.lata, 'going'), rsvp(ev('bhajan'), u.farida, 'going'),
      rsvp(ev('movie'), elderId, 'maybe'), rsvp(ev('movie'), u.george, 'going'), rsvp(ev('movie'), u.anand, 'going'),
      rsvp(ev('diwali'), elderId, 'going'), rsvp(ev('diwali'), familyId, 'going'), rsvp(ev('diwali'), u.meera, 'going'), rsvp(ev('diwali'), u.rekha, 'going'), rsvp(ev('diwali'), u.vikram, 'going'), rsvp(ev('diwali'), u.joseph, 'maybe'), rsvp(ev('diwali'), u.suresh, 'not_going'),
      rsvp(ev('coffee'), familyId, 'going'), rsvp(ev('coffee'), u.nandini, 'going'),
      rsvp(ev('camp'), elderId, 'going'), rsvp(ev('camp'), u.george, 'going'), rsvp(ev('camp'), u.joseph, 'going'), rsvp(ev('camp'), u.lata, 'going'), rsvp(ev('camp'), u.sunita, 'going'),
      rsvp(ev('nandi'), u.suresh, 'going'), rsvp(ev('nandi'), u.anand, 'maybe'),
      rsvp(ev('flag'), elderId, 'going'), rsvp(ev('flag'), familyId, 'going'),
    ],
  });
  tally.add('Events and RSVPs', events.length + 26);

  // ─── Helplines ───────────────────────────────────────────────────────────
  await prisma.communityHelpline.createMany({
    data: [
      { neighborhoodId: nId, label: 'Security gate desk (24 hours)', phone: '08040000001', category: 'security', sortOrder: 1 },
      { neighborhoodId: nId, label: 'Clubhouse and office', phone: '08040000002', category: 'general', sortOrder: 2 },
      { neighborhoodId: nId, label: 'Resident doctor on call - Dr. Anita Rao', phone: '9000000201', category: 'medical', sortOrder: 3 },
      { neighborhoodId: nId, label: 'Ambulance', phone: '108', category: 'medical', sortOrder: 4 },
      { neighborhoodId: nId, label: 'Police', phone: '100', category: 'police', sortOrder: 5 },
      { neighborhoodId: nId, label: 'Fire', phone: '101', category: 'fire', sortOrder: 6 },
      { neighborhoodId: nId, label: 'Women helpline', phone: '1091', category: 'police', sortOrder: 7 },
      { neighborhoodId: nId, label: 'BESCOM power failure', phone: '1912', category: 'utility', sortOrder: 8 },
      { neighborhoodId: nId, label: 'BWSSB water supply', phone: '1916', category: 'utility', sortOrder: 9 },
    ],
  });
  tally.add('Helplines', 9);

  // ─── Committee queries and the help desk ─────────────────────────────────
  const q = (type: 'committee' | 'helpdesk', category: 'water' | 'electricity' | 'cleaning' | 'safety' | 'cultural' | 'driver' | 'other' | null, subject: string, body: string, userId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', hoursBack: number) =>
    ({ id: newId(), neighborhoodId: nId, type, category, subject, body, userId, status, createdAt: hoursAgo(hoursBack) });
  const queries = [
    q('committee', null, 'Handrail needed in the Block A stairwell', 'Several elderly residents find the stairs between the ground and first floor difficult. Could the committee consider adding a handrail along the second side too?', elderId, 'in_progress', 70),
    q('helpdesk', 'water', 'Low water pressure on the 4th floor', 'Since Monday the water pressure in the 4th floor bathrooms is very low in the mornings.', u.lata, 'open', 28),
    q('helpdesk', 'electricity', 'Corridor light not working near B-203', 'The corridor light on the second floor of Block B has been off for three days.', u.vikram, 'resolved', 120),
    q('helpdesk', 'cleaning', 'Garbage not collected on Sunday', 'Dry waste was not collected on Sunday and the bins near Block C are overflowing.', u.anand, 'closed', 200),
    q('helpdesk', 'safety', 'Stray dogs near the main gate at night', 'Residents returning late and elders on evening walks feel unsafe. Could the security guard be asked to keep the gate lights on?', u.farida, 'in_progress', 50),
    q('committee', null, 'Booking the clubhouse for an anniversary', 'We would like to host a small family anniversary lunch for around 30 guests. What are the booking rules and charges?', u.sunita, 'open', 14),
    q('helpdesk', 'driver', 'Reliable driver for weekly hospital visits', 'My mother needs a trusted driver every Thursday for her hospital visit. Can the committee suggest someone?', familyId, 'resolved', 180),
    q('helpdesk', 'cultural', 'Suggestion: Kannada Rajyotsava celebration', 'Can we plan a small cultural programme for Rajyotsava with songs and folk dance by the residents?', u.nandini, 'open', 40),
  ];
  await prisma.committeeQuery.createMany({ data: queries });
  const reply = (queryIdx: number, userId: string, body: string, hoursBack: number) => ({ queryId: queries[queryIdx].id, userId, body, createdAt: hoursAgo(hoursBack) });
  await prisma.committeeQueryReply.createMany({
    data: [
      reply(0, u.meera, 'Thank you for raising this. We have asked the contractor for a quote for the second handrail.', 60),
      reply(0, familyId, 'I can share the measurements. Mother and a few others use that stairwell every day.', 55),
      reply(0, u.ramesh, 'Quote received at Rs 38,000. Will place it before the committee on Sunday.', 20),
      reply(2, u.ramesh, 'The electrician is scheduled for tomorrow morning.', 110),
      reply(2, u.vikram, 'Fixed this morning. Thanks!', 90),
      reply(3, u.meera, 'Housekeeping has been told. Closing this once the next collection is confirmed.', 190),
      reply(4, u.meera, 'We have asked the agency to keep a guard at the gate until 11 PM and to switch on the extra light.', 40),
      reply(6, u.meera, 'Ravi Kumar from the auto stand is very reliable with elders. His number is in Community > Auto & Taxi.', 170),
      reply(6, familyId, 'Booked him for Thursday. Thank you!', 160),
      reply(1, u.ramesh, 'The plumber has been called to check the pump. We will update by evening.', 20),
    ],
  });
  tally.add('Queries and help-desk tickets', queries.length + 10);

  // ─── WhatsApp groups and chat ────────────────────────────────────────────
  await prisma.whatsAppGroupLink.createMany({
    data: [
      { neighborhoodId: nId, name: 'Sunrise Residents - Announcements', description: 'Official notices from the committee. (Demo link - replace with your group’s invite.)', inviteUrl: 'https://chat.whatsapp.com/DemoSunriseAnnounce', createdById: u.meera },
      { neighborhoodId: nId, name: 'Block A Neighbours', description: 'Friendly chat for Block A. (Demo link.)', inviteUrl: 'https://chat.whatsapp.com/DemoBlockANeighbours', createdById: u.ramesh },
      { neighborhoodId: nId, name: 'Morning Walkers', description: 'Coordinate the 6 AM walk around the lawn. (Demo link.)', inviteUrl: 'https://chat.whatsapp.com/DemoMorningWalkers', createdById: u.suresh },
      { neighborhoodId: nId, name: 'Seniors’ Buddy Circle', description: 'Seniors and volunteers who check in on each other. (Demo link.)', inviteUrl: 'https://chat.whatsapp.com/DemoSeniorsBuddy', createdById: u.nandini },
    ],
  });

  const chat: Array<[string, string, number]> = [
    [u.sunita, 'Good morning everyone! Beautiful weather for the walk today.', 52],
    [u.george, 'Morning Sunita. Joining you at 6:30.', 51],
    [elderId, 'Good morning. I will come to the lawn after my tea.', 50],
    [u.meera, 'Reminder: water tank cleaning this Saturday. Please store water.', 30],
    [u.lata, 'Thank you Meera. Will the tanker come for Block C also?', 29],
    [u.meera, 'Yes, Block C too. Details on the notice board.', 29],
    [u.vikram, 'Anyone needs help carrying water on Saturday? I am free in the morning.', 28],
    [elderId, 'That is kind of you, Vikram. I may need help with two cans.', 27],
    [u.vikram, 'Of course, aunty. I will come at 9:30.', 27],
    [u.rekha, 'Bhajan Sandhya is on Thursday at 6:30 PM. Do come!', 20],
    [u.farida, 'I will bring the harmonium.', 19],
    [u.sunita, 'Wonderful. Lakshmi, you will sing the Annamayya kriti?', 18],
    [elderId, 'Only if you all sing along.', 17],
    [u.joseph, 'Has anyone seen a small brown umbrella near the clubhouse?', 12],
    [u.nandini, 'I think I saw it at the security desk, Joseph uncle.', 11],
    [u.joseph, 'Found it. Thank you!', 10],
    [familyId, 'Reminder: health camp for seniors on the 10th. Please register at the clubhouse.', 6],
    [u.ramesh, 'Maintenance for this month is open on the Fees page. Online payment is now available.', 4],
    [u.anand, 'Good evening all. Chess club tonight at 7.', 2],
  ];
  await prisma.chatMessage.createMany({ data: chat.map(([senderId, body, h]) => ({ neighborhoodId: nId, senderId, body, createdAt: hoursAgo(h) })) });
  tally.add('WhatsApp groups and chat messages', 4 + chat.length);

  // ─── Marketplace and jobs ────────────────────────────────────────────────
  await prisma.marketplaceListing.createMany({
    data: [
      { neighborhoodId: nId, postedById: u.george, listingType: 'sell', title: 'Two-seater sofa in good condition', description: 'Teak frame, firm cushions. Moving to a smaller flat.', price: 6500, priceUnit: 'one-time', imagePath: '/demo/market/sofa.svg', contactPhone: '9000000107', houseNumber: 'B-101', preferredContactTime: 'Evenings', createdAt: hoursAgo(40) },
      { neighborhoodId: nId, postedById: u.anand, listingType: 'sell', title: 'Exercise cycle', description: 'Barely used. Adjustable resistance and a heart-rate display.', price: 4200, priceUnit: 'one-time', imagePath: '/demo/market/bicycle.svg', contactPhone: '9000000108', houseNumber: 'C-102', createdAt: hoursAgo(90) },
      { neighborhoodId: nId, postedById: u.joseph, listingType: 'lend', title: 'Folding walker available to lend', description: 'Lightweight aluminium walker. Free to borrow during recovery - please return when done.', imagePath: '/demo/market/walker.svg', contactPhone: '9000000113', houseNumber: 'D-301', createdAt: hoursAgo(110) },
      { neighborhoodId: nId, postedById: u.sunita, listingType: 'sell', title: 'Collection of Kannada novels', description: 'Twenty classic Kannada novels in good condition.', price: 800, priceUnit: 'one-time', imagePath: '/demo/market/books.svg', contactPhone: '9000000104', houseNumber: 'A-102', createdAt: hoursAgo(170) },
      { neighborhoodId: nId, postedById: u.lata, listingType: 'wanted', title: 'Looking for a second-hand wheelchair', description: 'For a relative recovering from surgery. Happy to rent for a month.', contactPhone: '9000000109', houseNumber: 'C-205', createdAt: hoursAgo(26) },
      { neighborhoodId: nId, postedById: u.vikram, listingType: 'rent', title: 'Projector for rent', description: 'HD projector for movie nights or presentations. Includes HDMI cable.', price: 300, priceUnit: 'per day', contactPhone: '9000000110', houseNumber: 'B-304', createdAt: hoursAgo(210) },
      { neighborhoodId: nId, postedById: u.meera, listingType: 'sell', title: 'Air purifier', description: 'Works well for a 200 sq ft room. Filters changed in March.', price: 5500, priceUnit: 'one-time', contactPhone: '9000000101', houseNumber: 'C-301', status: 'reserved', createdAt: hoursAgo(250) },
      { neighborhoodId: nId, postedById: u.farida, listingType: 'lend', title: 'Pressure cooker (5 litre)', description: 'Happy to lend for festival cooking.', contactPhone: '9000000106', houseNumber: 'A-305', createdAt: hoursAgo(300) },
    ],
  });
  await prisma.communityJobPosting.createMany({
    data: [
      { neighborhoodId: nId, postedById: u.joseph, postingType: 'job_offered', title: 'Part-time cook for an elderly couple', description: 'Simple vegetarian meals, low salt. Two hours in the morning.', compensation: 'Rs 9,000 per month', contactPhone: '9000000113', houseNumber: 'D-301', createdAt: hoursAgo(35) },
      { neighborhoodId: nId, postedById: u.rekha, postingType: 'job_offered', title: 'Housekeeping help, 2 hours daily', description: 'Sweeping, mopping and dusting. Mornings preferred.', compensation: 'Rs 6,000 per month', contactPhone: '9000000103', houseNumber: 'A-404', createdAt: hoursAgo(80) },
      { neighborhoodId: nId, postedById: u.nandini, postingType: 'job_wanted', title: 'Experienced attendant seeking night shifts', description: 'Referred by two families in the community. Comfortable with bedridden patients.', compensation: 'Negotiable', contactPhone: '9000000112', houseNumber: 'D-204', createdAt: hoursAgo(130) },
      { neighborhoodId: nId, postedById: u.anand, postingType: 'resource_offered', title: 'Maths tuition for classes 8 to 10', description: 'Retired school teacher offering evening tuition in the community.', compensation: 'Rs 400 per hour', contactPhone: '9000000108', houseNumber: 'C-102', createdAt: hoursAgo(180) },
      { neighborhoodId: nId, postedById: familyId, postingType: 'resource_wanted', title: 'Companion for evening walks', description: 'Looking for a kind volunteer or paid companion for a gentle evening walk, three days a week.', compensation: 'Rs 300 per walk', contactPhone: '9000000002', houseNumber: 'B-110', createdAt: hoursAgo(15) },
    ],
  });
  tally.add('Marketplace and jobs', 13);

  // ─── Documents, fees, accounts ───────────────────────────────────────────
  await prisma.communityDocument.createMany({
    data: [
      { neighborhoodId: nId, title: 'Association bye-laws', category: 'bylaws', fileName: 'bylaws.pdf', filePath: '/demo/docs/bylaws.pdf', fileType: 'application/pdf', uploadedById: u.meera, createdAt: at(-120) },
      { neighborhoodId: nId, title: 'AGM minutes - June 2026', category: 'minutes', fileName: 'agm-minutes.pdf', filePath: '/demo/docs/agm-minutes.pdf', fileType: 'application/pdf', uploadedById: u.meera, createdAt: at(-110) },
      { neighborhoodId: nId, title: 'Water tank cleaning notice', category: 'notice', fileName: 'water-tank-notice.pdf', filePath: '/demo/docs/water-tank-notice.pdf', fileType: 'application/pdf', uploadedById: u.ramesh, createdAt: at(-1) },
      { neighborhoodId: nId, title: 'Fire safety circular', category: 'other', fileName: 'fire-safety.pdf', filePath: '/demo/docs/fire-safety.pdf', fileType: 'application/pdf', uploadedById: u.meera, createdAt: at(-40) },
    ],
  });

  const feeMonthly = newId();
  const feeSinking = newId();
  await prisma.communityFee.createMany({
    data: [
      { id: feeMonthly, neighborhoodId: nId, label: 'Monthly maintenance', defaultAmount: 3500, frequency: 'monthly', createdById: u.ramesh },
      { id: feeSinking, neighborhoodId: nId, label: 'Sinking fund 2026', defaultAmount: 5000, frequency: 'one_time', createdById: u.ramesh },
    ],
  });
  const allResidents = members.filter((m) => m.status !== 'pending').map((m) => m.userId);
  const earlyPayers = new Set([familyId, u.meera, u.ramesh, u.rekha, u.sunita, u.kiran, u.george]);
  const overdue = new Set([u.lata, u.joseph]);
  const charges: Prisma.FeeChargeCreateManyInput[] = [];
  const platformPct = 0.05;
  const addCharge = (feeId: string, userId: string, period: string, due: Date, amount: number, paid: boolean) => {
    const fee = paid ? Math.round(amount * platformPct * 100) / 100 : null;
    charges.push({
      communityFeeId: feeId, neighborhoodMemberId: memberId[userId], residentUserId: userId, period, amount, dueDate: due,
      status: paid ? 'paid' : 'due',
      razorpayPaymentId: paid ? `pay_demo_${newId().slice(0, 12)}` : null,
      paidAt: paid ? new Date(Math.min(due.getTime() - 3 * 86_400_000, Date.now() - 5 * 3_600_000)) : null,
      paidByUserId: paid ? (userId === elderId ? familyId : userId) : null,
      platformFeeAmount: fee, netAmountForAssociation: fee === null ? null : amount - fee,
    });
  };
  for (let back = 3; back >= 0; back--) {
    const { period, due } = billingPeriod(back);
    for (const uid of allResidents) {
      const paid = back >= 2 ? true : back === 1 ? !overdue.has(uid) : earlyPayers.has(uid);
      addCharge(feeMonthly, uid, period, due, 3500, paid);
    }
  }
  const sinkingDue = at(20);
  for (const uid of allResidents) addCharge(feeSinking, uid, 'one-time', sinkingDue, 5000, [familyId, u.meera, u.ramesh, u.george, u.anand].includes(uid));
  await prisma.feeCharge.createMany({ data: charges });
  tally.add('Maintenance fees and charges', 2 + charges.length);

  const exp = (label: string, amount: number, category: string, daysBack: number, by: string, notes?: string) =>
    ({ neighborhoodId: nId, label, amount, category, spentOn: at(-daysBack), addedById: by, notes: notes ?? null });
  await prisma.associationExpense.createMany({
    data: [
      exp('Security guards - salaries', 16000, 'Security', 8, u.ramesh),
      exp('Housekeeping contract', 9500, 'Housekeeping', 9, u.ramesh),
      exp('Common area electricity', 6200, 'Electricity', 12, u.ramesh, 'BESCOM bill for the common meters.'),
      exp('Lift annual maintenance', 4500, 'Repairs', 20, u.ramesh),
      exp('Garden and landscaping', 1800, 'Garden', 22, u.ramesh),
      exp('Water tankers', 3500, 'Water', 30, u.ramesh, 'Summer shortfall.'),
      exp('Plumbing repairs - Block C', 2400, 'Repairs', 36, u.ramesh),
      exp('Security guards - salaries', 16000, 'Security', 38, u.ramesh),
      exp('Housekeeping contract', 9500, 'Housekeeping', 39, u.ramesh),
      exp('Diesel for generator', 2800, 'Electricity', 41, u.ramesh),
      exp('Common area electricity', 5900, 'Electricity', 42, u.ramesh),
      exp('Common area insurance', 3750, 'Insurance', 55, u.ramesh),
      exp('Festival decoration', 1900, 'Events', 62, u.rekha),
      exp('Security guards - salaries', 16000, 'Security', 68, u.ramesh),
      exp('Housekeeping contract', 9500, 'Housekeeping', 69, u.ramesh),
      exp('Common area electricity', 6800, 'Electricity', 72, u.ramesh),
    ],
  });
  tally.add('Association expenses', 16);

  // ─── Hobby groups ────────────────────────────────────────────────────────
  const hobbyDefs = [
    { key: 'bhajan', name: 'Bhajan Mandali', category: 'music' as const, description: 'Devotional singing every Thursday evening at the clubhouse.', by: u.sunita },
    { key: 'chess', name: 'Sunrise Chess Club', category: 'other' as const, description: 'Friendly games every evening at 7. All levels welcome.', by: u.anand },
    { key: 'rangoli', name: 'Rangoli and Craft Circle', category: 'art' as const, description: 'Festival rangoli, paper craft and card-making with the children.', by: u.rekha },
    { key: 'books', name: 'Book Club', category: 'books' as const, description: 'One book a month. Discussion on the first Sunday over tea.', by: u.farida },
    { key: 'walkers', name: 'Morning Walkers', category: 'other' as const, description: 'A 6 AM walk around the lawn followed by light stretching.', by: u.suresh },
  ].map((h) => ({ ...h, id: newId() }));
  await prisma.hobbyGroup.createMany({ data: hobbyDefs.map((h) => ({ id: h.id, neighborhoodId: nId, name: h.name, category: h.category, description: h.description, createdById: h.by })) });
  const hobbyMembers = new Map<string, Set<string>>();
  const joinHobby = (key: string, userId: string) => hobbyMembers.set(key, (hobbyMembers.get(key) ?? new Set()).add(userId));
  for (const n of NEIGHBOURS) for (const h of n.hobbies ?? []) joinHobby(h, u[n.key]);
  for (const k of ['bhajan', 'books', 'walkers']) joinHobby(k, elderId);
  joinHobby('chess', familyId);
  for (const h of hobbyDefs) joinHobby(h.key, h.by);
  const hobbyRows = [...hobbyMembers.entries()].flatMap(([key, set]) => [...set].map((userId) => ({ hobbyGroupId: hobbyDefs.find((h) => h.key === key)!.id, userId })));
  await prisma.hobbyGroupMember.createMany({ data: hobbyRows });
  tally.add('Hobby groups and members', hobbyDefs.length + hobbyRows.length);

  // ─── Vendors directory ───────────────────────────────────────────────────
  const listing = (name: string, category: string, phone: string, tags: Record<string, string>, description: string, address?: string) =>
    ({ id: newId(), neighborhoodId: nId, name, category, phone, description, address: address ?? null, addedById: u.meera, verified: true, ...tags });
  const pharmacyListing = { ...listing('City Care Pharmacy', 'Pharmacy', '9000000003', { shopCategory: 'medical_store' }, 'Medicines, health devices and free home delivery for residents. Monthly refill reminders.', '21, 100 Feet Road, Indiranagar'), addedById: p.providerUserId };
  const vendors = [
    listing('Shankar Plumbing Works', 'Plumber', '9000000402', { homeMaintenanceCategory: 'leakage' }, 'Leakage repair, tap and pipe fitting. Same-day visits.'),
    listing('Vijay Electricals', 'Electrician', '9000000403', { homeMaintenanceCategory: 'electrical' }, 'Wiring, switches, fans and inverter servicing.'),
    listing('Kamala Housekeeping', 'Housekeeping', '9000000404', { homeMaintenanceCategory: 'maid' }, 'Trusted daily and weekly cleaning help.'),
    listing('Annapurna Home Cooks', 'Cook', '9000000405', { homeMaintenanceCategory: 'cook' }, 'Home cooks for diabetic and low-salt diets.'),
    listing('Prasad Painters', 'Painter', '9000000406', { homeMaintenanceCategory: 'painting' }, 'Interior painting and waterproofing.'),
    listing('Gowda Garden Care', 'Gardener', '9000000407', { homeMaintenanceCategory: 'gardening' }, 'Balcony and terrace garden maintenance.'),
    listing('Raju Carpentry', 'Carpenter', '9000000408', { homeMaintenanceCategory: 'carpentry' }, 'Furniture repair and grab-bar installation.'),
    listing('Sri Ganesh Medicals', 'Medical store', '9000000409', { shopCategory: 'medical_store' }, 'Open till 11 PM. Home delivery on call.'),
    listing('Daily Fresh Supermarket', 'Supermarket', '9000000410', { shopCategory: 'supermarket' }, 'Groceries and household items. Senior discount on Wednesdays.'),
    listing('Cakes & More Bakery', 'Bakery', '9000000411', { shopCategory: 'bakery' }, 'Fresh bread, sugar-free cakes and snacks.'),
    listing('Kumar Stationery', 'Stationery', '9000000412', { shopCategory: 'stationery' }, 'Books, stationery and photocopying.'),
    listing('Hardware Hub', 'Hardware', '9000000413', { shopCategory: 'hardware_store' }, 'Tools, paints and plumbing fittings.'),
    listing('Asha Companion Care', 'Companion care', '9000000414', { elderCareCategory: 'companion_service' }, 'Friendly companions for walks, reading and hospital visits.'),
    listing('Sevana Home Nursing', 'Home nursing', '9000000206', { elderCareCategory: 'home_nursing' }, 'Trained nurses and attendants for home care.'),
  ];
  await prisma.localListing.createMany({ data: [pharmacyListing, ...vendors] });
  await prisma.communityProviderListing.createMany({
    data: [
      { providerId: prov.id.pharmacy, neighborhoodId: nId, status: 'approved', communityApprovedAt: at(-100), communityApprovedById: u.meera, platformApprovedAt: at(-98), platformApprovedById: p.adminId, localListingId: pharmacyListing.id },
      { providerId: prov.id.nursing, neighborhoodId: nId, status: 'communityApproved', communityApprovedAt: at(-2), communityApprovedById: u.meera },
      { providerId: prov.id.grocery, neighborhoodId: nId, status: 'pending' },
    ],
  });
  tally.add('Vendors and provider approvals', vendors.length + 4);

  // ─── Volunteers ──────────────────────────────────────────────────────────
  const volunteers = [
    ...NEIGHBOURS.filter((n) => n.volunteer).map((n) => ({ userId: u[n.key], availability: n.volunteer!.availability, types: n.volunteer!.types, status: 'verified' as const })),
    { userId: u.suresh, availability: 'weekends' as const, types: ['companionship', 'errands'], status: 'pending' as const },
  ];
  await prisma.volunteerProfile.createMany({
    data: volunteers.map((v) => ({ userId: v.userId, availability: v.availability, assistanceTypes: v.types, verificationStatus: v.status, isActive: true })),
  });
  tally.add('Community volunteers', volunteers.length);

  // ─── Local directory: bulk-added residents, a match to review, house pins ─
  const dir = (name: string, phone: string | null, flat: string, extra: Record<string, unknown> = {}) => ({ id: newId(), neighborhoodId: nId, name, phone, flatNumber: flat, importedById: p.adminId, ...extra });
  const placeholders = [
    dir('Hari Prasad', '9000000501', 'B-102'),
    dir('Zainab Begum', '9000000502', 'C-401', { invitedAt: hoursAgo(48) }),
    dir('Narasimha Murthy', '9000000503', 'D-103'),
    dir('Savita Kamath', null, 'A-303'),
    dir('Dr. Ashok Verma', '9000000504', 'C-303', { invitedAt: hoursAgo(48) }),
    dir('Parvathi Amma', '9000000505', 'D-401'),
    dir('Anand S.', '9000000506', 'C-102'),
  ];
  await prisma.unregisteredResident.createMany({ data: placeholders });
  await prisma.directoryMatchSuggestion.create({
    data: { neighborhoodId: nId, placeholderId: placeholders[6].id, userId: u.anand, reason: 'house_and_name', score: 0.88 },
  });
  const pins: Array<[string, number, number]> = [
    [ELDER_FLAT, 12.97845, 77.64085], [FAMILY_FLAT, 12.97832, 77.64102], ['C-301', 12.97861, 77.64121], ['A-101', 12.97839, 77.64071],
    ['B-203', 12.97828, 77.64095], ['D-204', 12.97851, 77.64132], ['C-102', 12.97858, 77.64118], ['A-102', 12.97842, 77.64075],
  ];
  await prisma.houseLocation.createMany({
    data: pins.map(([house, lat, lng]) => ({ neighborhoodId: nId, houseKey: houseKey(house), house, lat, lng, setById: house === ELDER_FLAT || house === FAMILY_FLAT ? familyId : u.meera, setByRole: 'committee' })),
  });
  tally.add('Local directory (bulk-added residents, match review, house pins)', placeholders.length + 1 + pins.length);

  // ─── Neighbours: favourites, hellos, preferences, a past panic alert ─────
  await prisma.neighborFavorite.createMany({
    data: [
      { userId: elderId, neighborhoodId: nId, entryKey: `member:${u.meera}` },
      { userId: elderId, neighborhoodId: nId, entryKey: `member:${u.kiran}` },
      { userId: elderId, neighborhoodId: nId, entryKey: `member:${u.sunita}` },
      { userId: familyId, neighborhoodId: nId, entryKey: `member:${u.kiran}` },
    ],
  });
  await prisma.greeting.createMany({
    data: [
      { neighborhoodId: nId, fromUserId: u.sunita, toUserId: elderId, message: 'Good morning, Lakshmi! See you on the walk.', readAt: null, createdAt: minutesAgo(70) },
      { neighborhoodId: nId, fromUserId: u.farida, toUserId: elderId, message: 'Thinking of you. Hope the knee is better.', readAt: hoursAgo(20), createdAt: hoursAgo(30) },
      { neighborhoodId: nId, fromUserId: elderId, toUserId: u.george, message: 'Thank you for the chess game yesterday!', readAt: hoursAgo(40), createdAt: hoursAgo(44) },
      { neighborhoodId: nId, fromUserId: u.kiran, toUserId: familyId, message: 'Happy to take Aunty for her hospital visit on Thursday.', readAt: hoursAgo(5), createdAt: hoursAgo(8) },
    ],
  });
  const prefs = (userId: string) => ['announcements', 'events', 'chat', 'greetings', 'queries'].map((category) => ({ userId, category, push: category !== 'chat', email: category === 'announcements' }));
  await prisma.notificationPreference.createMany({ data: [...prefs(elderId), ...prefs(familyId)] });
  await prisma.sOSEvent.create({
    data: { userId: elderId, triggerType: 'community_panic', neighborhoodId: nId, lat: 12.9784, lng: 77.6408, address: 'A-204, Sunrise Residency', status: 'resolved', acknowledgedBy: u.meera, createdAt: at(-9, '19:12'), resolvedAt: at(-9, '19:30') },
  });
  tally.add('Neighbours (favourites, hellos, preferences, past panic alert)', 4 + 4 + 10 + 1);

  return { neighborhoodId: nId, memberId };
}
