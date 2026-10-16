import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { houseKey } from '@/lib/house';
import type { DemoPeople } from './accounts';
import type { DemoProviders } from './providers';
import {
  addressOf, at, billingPeriod, DEMO_CITY, DEMO_COMMUNITY_CODE, DEMO_COMMUNITY_NAME, DEMO_EMAIL_DOMAIN, DEMO_LAT, DEMO_LNG, DEMO_LOCALITY,
  DEMO_PINCODE, hoursAgo, makeRng, newId, type Tally,
} from './helpers';
import { ELDER, FAMILY, LEGACY_DOCTORS, NEIGHBOURS, PENDING_JOINER } from './cast';

export interface DemoCommunity {
  neighborhoodId: string;
  /** NeighborhoodMember id by user id. */
  memberId: Record<string, string>;
  doctorIds: string[];
}

/** A house's position: numbered houses sit along roads; named houses are placed by their name. */
function pinFor(house: string): [number, number] {
  const digits = Number(house.replace(/\D+/g, ''));
  const n = digits || (house.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 40) + 1;
  const road = Math.floor((n - 1) / 10);
  const along = (n - 1) % 10;
  return [DEMO_LAT + (road - 2) * 0.00055 + (along % 2) * 0.00012, DEMO_LNG + (along - 5) * 0.00032 + (road % 2) * 0.00018];
}

/** The Kowdiar Gardens Residents Association: independent houses in Thiruvananthapuram, three months on EC. */
export async function buildCommunity(p: DemoPeople, prov: DemoProviders, tally: Tally): Promise<DemoCommunity> {
  const { elderId, familyId } = p;
  const u = p.neighbour;
  const nId = newId();
  const rng = makeRng(303);
  const houseOf = (key: string) => NEIGHBOURS.find((n) => n.key === key)!.house;
  const phoneOf = (key: string) => NEIGHBOURS.find((n) => n.key === key)!.phone;

  // Make the demo community each account's primary one, even if they already belong to another.
  const earliest = await prisma.neighborhoodMember.findMany({
    where: { userId: { in: [elderId, familyId] }, status: 'approved' },
    orderBy: { createdAt: 'asc' },
    take: 1,
    select: { createdAt: true },
  });
  const joinedFirst = earliest[0] ? new Date(Math.min(earliest[0].createdAt.getTime() - 86_400_000, at(-100).getTime())) : at(-100);

  await prisma.neighborhood.create({
    data: {
      id: nId, name: DEMO_COMMUNITY_NAME, city: DEMO_CITY, pincode: DEMO_PINCODE, housePrefix: 'KGRA', joinCode: DEMO_COMMUNITY_CODE, createdAt: at(-102),
      description: `A residents’ association of about 60 independent houses on four roads in ${DEMO_LOCALITY}, near Kowdiar Park — families who have lived here for generations alongside newer neighbours from across Kerala and beyond, and many elders whose children work abroad. On EC since July.`,
    },
  });

  // ─── Members ─────────────────────────────────────────────────────────────
  const memberId: Record<string, string> = {};
  const members: Array<{ userId: string; house: string; role: 'member' | 'committee' | 'admin'; joined: Date; status?: 'approved' | 'pending' }> = [
    { userId: elderId, house: ELDER.house, role: 'member', joined: joinedFirst },
    { userId: familyId, house: FAMILY.house, role: 'admin', joined: joinedFirst },
    ...NEIGHBOURS.map((n) => ({ userId: u[n.key], house: n.house, role: n.communityRole ?? ('member' as const), joined: at(-n.joined, '11:00') })),
    { userId: p.pendingJoinerId, house: PENDING_JOINER.house, role: 'member', joined: hoursAgo(20), status: 'pending' },
  ];
  await prisma.neighborhoodMember.createMany({
    data: members.map((m) => {
      const id = newId();
      memberId[m.userId] = id;
      return {
        id, neighborhoodId: nId, userId: m.userId, role: m.role, flatNumber: m.house, isBillingContact: true,
        showInDirectory: true, status: m.status ?? 'approved', approvedAt: m.status === 'pending' ? null : m.joined,
        approvedById: m.status === 'pending' ? null : familyId, createdAt: m.joined,
      };
    }),
  });
  tally.add('Community members', members.length);
  const residents = members.filter((m) => m.status !== 'pending').map((m) => m.userId);
  const joinedAt = new Map(members.map((m) => [m.userId, m.joined.getTime()]));

  // ─── How this locality joined EC ─────────────────────────────────────────
  await prisma.communityApplication.createMany({
    data: [
      {
        placeName: DEMO_COMMUNITY_NAME, applicantType: 'Residents’ association', city: DEMO_CITY, pincode: DEMO_PINCODE, numberOfFamilies: 60, housePrefix: 'KGRA',
        applicantName: 'Mini Varghese', applicantPhone: phoneOf('mini'), applicantEmail: `mini@${DEMO_EMAIL_DOMAIN}`, applicantDesignation: 'Secretary',
        status: 'approved', localityCode: 'EC-695003-KGRA', neighborhoodId: nId, reviewedById: p.adminId, reviewedAt: at(-102), createdAt: at(-106),
      },
      {
        placeName: 'Sasthamangalam Residents Forum', applicantType: 'Residents’ association', city: DEMO_CITY, pincode: '695010', numberOfFamilies: 45,
        applicantName: 'Sudarshan Pillai', applicantPhone: '9447215069', applicantEmail: `sudarshan@${DEMO_EMAIL_DOMAIN}`, applicantDesignation: 'President', status: 'pending', createdAt: at(-3),
      },
      {
        placeName: 'Peroorkada Housing Colony', applicantType: 'Housing colony committee', city: DEMO_CITY, pincode: '695005', numberOfFamilies: 24,
        applicantName: 'Mohan Das', applicantPhone: '9895321470', applicantEmail: `mohan@${DEMO_EMAIL_DOMAIN}`, applicantDesignation: 'Treasurer', status: 'rejected',
        rejectionReason: 'The proof of authority did not show the association’s registration number. Please re-apply with the registration certificate.', reviewedById: p.adminId, reviewedAt: at(-26), createdAt: at(-29),
      },
    ],
  });
  tally.add('Community applications', 3);

  // ─── Announcements across the three months ───────────────────────────────
  const notice = (d: number, by: string, title: string, body: string, pinned = false) => ({ neighborhoodId: nId, title, body, pinned, createdById: by, createdAt: at(d, '10:00') });
  await prisma.notice.createMany({
    data: [
      notice(-1, u.mini, 'Water supply interruption on Saturday', 'The Kerala Water Authority will interrupt supply from 9 AM to 5 PM for pipeline work at Kowdiar junction. Please store drinking water. Two tanker loads will be available at the community hall, and volunteers will help senior residents carry water — call the number on the notice board.', true),
      notice(-3, u.sheela, 'Navaratri pooja and bhajans at the community hall', 'Evening pooja and bhajans every day through Navaratri from 6:30 PM, with a Golu display by the children and Saraswati pooja on the ninth day. Everyone is welcome — please RSVP in Events.'),
      notice(-5, u.haridas, 'Vidyarambham for little ones on Vijayadashami', 'Children who are ready to start writing can have their Vidyarambham at the community hall on Vijayadashami morning, led by Ganapathy Namboothiri. Please register the child’s name with the committee.'),
      notice(-8, u.haridas, 'Monthly subscription due by the 10th', 'A gentle reminder that the monthly subscription is due by the 10th. You can pay online from Community > Fees. Receipts are emailed automatically.'),
      notice(-12, familyId, 'Free eye and BP check-up camp for senior citizens', 'A free camp with BP, sugar and eye-pressure checks for residents over 60 will be held at the community hall. Dr. Latha Varma and the Kowdiar Eye & Diabetes Centre team will attend. Please carry your previous reports.'),
      notice(-17, u.raghavan, 'New LED street lights on all four roads', 'The old street lights are being replaced with LED fittings this week. Please report any light that is still not working through the help desk.'),
      notice(-22, u.mini, 'Haritha Karma Sena collection schedule', 'Non-biodegradable waste is collected on the first Saturday of every month. Please keep it clean, dry and segregated. An e-waste collection camp will be held next month.'),
      notice(-27, u.sheela, 'Vinayaka Chaturthi celebration', 'Idol installation at the community hall, aarti every evening and immersion on the fifth day. Volunteers needed for decoration and prasad.'),
      notice(-34, u.raghavan, 'Northeast monsoon (Thulavarsham) precautions', 'Please keep drains and gutters clear and trim branches that touch power lines. Keep the KSEB emergency number 1912 handy. The committee has requested the Corporation to desilt the main drain.'),
      notice(-41, u.mini, 'Onam celebrations: pookalam competition and sadya', 'Join us for a pookalam competition on Uthradam, followed by Onasadya at the community hall. Each road will make one pookalam. Please contribute to the Onam fund.'),
      notice(-49, familyId, 'Panic alert now live on EC', 'Every resident can raise a panic alert from Community on the EC app. It notifies the committee and your emergency contacts together. Please try it once with the test button.'),
      notice(-57, u.haridas, 'Night watchman roster', 'Our night watchman now patrols all four roads from 9 PM to 5 AM. Please lock your gates and report anything unusual to Kerala Police on 112 and to the committee.'),
      notice(-66, u.raghavan, 'Independence Day flag hoisting', 'Flag hoisting at 8 AM at the community hall lawn, followed by sweets and songs by the children.'),
      notice(-75, u.mini, 'AGM minutes available', 'The minutes of the Annual General Meeting are now in Documents. The accounts for last year were adopted unanimously.'),
      notice(-84, u.haridas, 'Road tarring on Road 2', 'Road 2 will be tarred next week. Please move vehicles inside your compounds on the day.'),
      notice(-92, u.mini, 'Welcome to Kowdiar Gardens on EC', 'Our association is now on EC. Join with the code on the notice board, say hello to your neighbours in the directory and keep your phone number handy for the committee.'),
    ],
  });
  tally.add('Announcements', 16);

  // ─── Events with RSVPs ───────────────────────────────────────────────────
  type Cat = 'cultural' | 'local_tour' | 'movie' | 'social' | 'other';
  const ev = (key: string, d: number, hhmm: string, hours: number, category: Cat, title: string, location: string, description: string, by: string) => {
    const startsAt = at(d, hhmm);
    return { key, id: newId(), startsAt, endsAt: new Date(startsAt.getTime() + hours * 3_600_000), category, title, location, description, by, createdAt: at(d - 12, '10:00') };
  };
  const events = [
    ev('agm', -86, '10:30', 2, 'other', 'Annual General Meeting', 'Community hall', 'Accounts for the year, street lights and CCTV, waste collection and election of the committee.', u.raghavan),
    ev('ramayana', -80, '17:30', 2, 'cultural', 'Ramayana parayanam (Karkidakam)', 'Community hall', 'Evening reading of the Adhyatma Ramayanam through the Karkidakam month. Tea and prasad afterwards.', u.girija),
    ev('safety', -70, '17:00', 2, 'other', 'Monsoon safety talk', 'Community hall', 'A short talk on drains, trees near power lines and what to do during power cuts.', u.raghavan),
    ev('beach', -62, '07:00', 4, 'local_tour', 'Kovalam beach clean-up drive', 'Pick-up at the main gate', 'A community clean-up with breakfast on the beach. Gloves and bags provided.', u.abhijith),
    ev('flag', -56, '08:00', 2, 'cultural', 'Independence Day flag hoisting', 'Community hall lawn', 'Flag hoisting followed by sweets and songs by the children.', u.raghavan),
    ev('heritage', -50, '09:00', 4, 'local_tour', 'Heritage walk: Napier Museum and the zoo', 'Pick-up at the main gate', 'A gentle guided walk through the museum gardens, with a wheelchair available and a stop for tea.', u.george),
    ev('onam', -45, '10:00', 6, 'social', 'Onam celebration: pookalam competition and sadya', 'Community hall', 'Each road makes a pookalam, followed by Onasadya on banana leaves, vallamkali video and games.', u.sheela),
    ev('ganesh', -26, '18:30', 2, 'cultural', 'Vinayaka Chaturthi aarti and bhajans', 'Community hall', 'Evening aarti and bhajans by the Bhajan Mandali. Prasad for all.', u.girija),
    ev('chess', -21, '17:00', 3, 'social', 'Inter-road chess tournament', 'Community hall', 'Friendly knock-out tournament. Trophy for the winner and tea for everyone.', u.venkatesh),
    ev('camp1', -12, '09:00', 4, 'other', 'Free eye and BP check-up camp', 'Community hall', 'Eye pressure and BP checks with the Kowdiar Eye & Diabetes Centre team.', familyId),
    ev('navaratri', 2, '18:30', 2, 'cultural', 'Navaratri pooja and bhajans', 'Community hall', 'Evening pooja, a children’s Golu display and devotional songs by the Bhajan Mandali. Tea and prasad afterwards.', u.sheela),
    ev('movie', 4, '18:00', 3, 'movie', 'Movie evening: a classic Malayalam family film', 'Community hall', 'A beloved old Malayalam film with subtitles. Popcorn and comfortable seating for seniors.', u.sheela),
    ev('camp2', 6, '09:00', 4, 'other', 'Senior citizens health check-up camp', 'Community hall', 'Free BP, sugar and bone density checks with Dr. Latha Varma. Registration at the door.', familyId),
    ev('coffee', 8, '08:30', 1.5, 'social', 'Sunday coffee morning', 'Community hall lawn', 'Meet your neighbours over filter coffee and idli. A relaxed start to the weekend.', u.mini),
    ev('vidya', 10, '07:30', 2, 'cultural', 'Vidyarambham on Vijayadashami', 'Community hall', 'Little ones write their first letters with a guru. Registration with the committee.', u.haridas),
    ev('ponmudi', 16, '06:30', 11, 'local_tour', 'Day trip to Ponmudi hills', 'Pick-up at the main gate', 'A comfortable day out by tempo traveller with an easy walk and a hill-top lunch.', u.anjana),
    ev('piravi', 22, '17:30', 3, 'cultural', 'Kerala Piravi cultural evening and Malayalam quiz', 'Community hall', 'Songs, a Malayalam quiz for all ages and a small exhibition of old Kerala household objects.', u.girija),
  ];
  await prisma.communityEvent.createMany({
    data: events.map((e) => ({ id: e.id, neighborhoodId: nId, title: e.title, description: e.description, location: e.location, category: e.category, startsAt: e.startsAt, endsAt: e.endsAt, createdById: e.by, createdAt: e.createdAt })),
  });
  const rsvps: Prisma.CommunityEventRsvpCreateManyInput[] = [];
  for (const e of events) {
    const past = e.startsAt.getTime() < Date.now();
    const base = e.category === 'cultural' ? 0.55 : e.category === 'movie' ? 0.4 : 0.35;
    for (const uid of residents) {
      if (joinedAt.get(uid)! > e.createdAt.getTime() + 86_400_000 * 14) continue;
      const isCore = uid === elderId || uid === familyId;
      if (!rng.chance(isCore ? 0.8 : base)) continue;
      const roll = rng.next();
      rsvps.push({ eventId: e.id, userId: uid, status: past ? (roll < 0.9 ? 'going' : 'not_going') : roll < 0.7 ? 'going' : roll < 0.9 ? 'maybe' : 'not_going', createdAt: new Date(e.createdAt.getTime() + rng.int(1, 9) * 86_400_000) });
    }
  }
  await prisma.communityEventRsvp.createMany({ data: rsvps });
  tally.add('Events and RSVPs', events.length + rsvps.length);

  // ─── Helplines ───────────────────────────────────────────────────────────
  await prisma.communityHelpline.createMany({
    data: [
      { neighborhoodId: nId, label: 'Night watchman and association office', phone: '9447090011', category: 'security', sortOrder: 1 },
      { neighborhoodId: nId, label: 'Community hall caretaker', phone: '9447090012', category: 'general', sortOrder: 2 },
      { neighborhoodId: nId, label: 'Resident doctor on call — Dr. Latha Varma', phone: '9847103265', category: 'medical', sortOrder: 3 },
      { neighborhoodId: nId, label: 'Ambulance', phone: '108', category: 'medical', sortOrder: 4 },
      { neighborhoodId: nId, label: 'Kerala Police', phone: '112', category: 'police', sortOrder: 5 },
      { neighborhoodId: nId, label: 'Fire and Rescue', phone: '101', category: 'fire', sortOrder: 6 },
      { neighborhoodId: nId, label: 'Women helpline', phone: '1091', category: 'police', sortOrder: 7 },
      { neighborhoodId: nId, label: 'KSEB power failure and emergencies', phone: '1912', category: 'utility', sortOrder: 8 },
      { neighborhoodId: nId, label: 'Kerala Water Authority', phone: '1916', category: 'utility', sortOrder: 9 },
    ],
  });
  tally.add('Helplines', 9);

  // ─── Committee queries and the help desk ─────────────────────────────────
  type Cx = 'water' | 'electricity' | 'cleaning' | 'safety' | 'cultural' | 'driver' | 'other';
  type St = 'open' | 'in_progress' | 'resolved' | 'closed';
  const q = (daysAgo: number, type: 'committee' | 'helpdesk', category: Cx | null, subject: string, body: string, userId: string, status: St) =>
    ({ id: newId(), neighborhoodId: nId, type, category, subject, body, userId, status, createdAt: at(-daysAgo, `${rng.int(8, 19)}:${String(rng.int(0, 59)).padStart(2, '0')}`) });
  const queries = [
    q(3, 'committee', null, 'Handrail and ramp at the community hall entrance', 'The hall has three steps at the entrance. Several of us find it hard to climb. Could a handrail and a ramp be added?', elderId, 'in_progress'),
    q(1, 'helpdesk', 'water', 'Low water pressure on Road 4', 'Since Monday the KWA supply pressure on Road 4 is very low in the mornings.', u.annamma, 'open'),
    q(11, 'helpdesk', 'electricity', 'Street light off near KGRA-22', 'The street light at the corner near KGRA-22 has been off for three days and the lane is dark at night.', u.rahul, 'resolved'),
    q(23, 'helpdesk', 'cleaning', 'Garbage not collected last Saturday', 'The Haritha Karma Sena did not collect the non-biodegradable waste last Saturday.', u.venkatesh, 'closed'),
    q(5, 'helpdesk', 'safety', 'Stray dogs near the main gate at night', 'Residents returning late and elders on evening walks feel unsafe. Could the watchman keep the gate light on?', u.fathima, 'in_progress'),
    q(2, 'committee', null, 'Booking the community hall for an anniversary', 'We would like to host a small family anniversary lunch for around 40 guests. What are the booking rules and charges?', u.girija, 'open'),
    q(19, 'helpdesk', 'driver', 'Reliable driver for weekly hospital visits', 'My mother needs a trusted driver every Thursday for her hospital visit. Can the committee suggest someone?', familyId, 'resolved'),
    q(4, 'helpdesk', 'cultural', 'Suggestion: Kerala Piravi programme', 'Can we plan a small cultural programme and a Malayalam quiz for Kerala Piravi?', u.anjana, 'open'),
    q(38, 'helpdesk', 'other', 'Mosquito fogging after the rain', 'There are many mosquitoes since the rains. Could the Corporation or the association arrange fogging to prevent dengue?', u.george, 'resolved'),
    q(46, 'helpdesk', 'water', 'Overflow from the borewell tank', 'Water is overflowing from the common borewell tank every night.', u.basheer, 'closed'),
    q(52, 'helpdesk', 'electricity', 'Tree branch on the KSEB line, Road 1', 'A large branch is touching the line near KGRA-3 and sparks in the rain.', u.francis, 'resolved'),
    q(60, 'committee', null, 'Permission for a physiotherapist to visit', 'A physiotherapist visits my father twice a week. Can she be pre-registered with the watchman so she is not delayed at the gate?', u.kamini, 'resolved'),
    q(66, 'helpdesk', 'other', 'Notice board is too high for seniors', 'Can the notice board be lowered or a second one placed near the community hall?', u.haridas, 'closed'),
    q(72, 'helpdesk', 'safety', 'Snake spotted near the compound wall', 'A snake was seen near the wall of KGRA-9. Is there a snake-rescue contact we can keep?', u.fathima, 'resolved'),
    q(80, 'committee', null, 'Delivery staff entering without registering', 'Delivery staff are walking into the roads without registering. Can the watchman log them?', u.mini, 'resolved'),
    q(88, 'helpdesk', 'safety', 'Poor lighting at the Road 3 corner', 'The corner is very dark and unsafe for senior residents walking in the evening.', u.george, 'closed'),
  ];
  await prisma.committeeQuery.createMany({ data: queries });
  const reply = (idx: number, userId: string, body: string, hoursAfter: number) =>
    ({ queryId: queries[idx].id, userId, body, createdAt: new Date(queries[idx].createdAt.getTime() + hoursAfter * 3_600_000) });
  const replies = [
    reply(0, u.mini, 'Thank you for raising this. We have asked a carpenter and a mason for a quote for the handrail and ramp.', 6),
    reply(0, familyId, 'I can share the measurements. Amma and a few others use the hall regularly.', 9),
    reply(0, u.haridas, 'Quote received at Rs 38,000. Will place it before the committee on Sunday.', 30),
    reply(1, u.haridas, 'We have complained to the KWA section office. They will check the line this afternoon.', 5),
    reply(2, u.haridas, 'The electrician is scheduled for tomorrow morning.', 8),
    reply(2, u.rahul, 'Fixed this morning. Thanks!', 30),
    reply(3, u.mini, 'The Haritha Karma Sena has been told. They will collect it on the next round.', 12),
    reply(4, u.mini, 'We have asked the watchman to keep the gate light on until 11 PM and to carry a torch on the rounds.', 20),
    reply(6, u.mini, 'Sajeev Kumar from the auto stand is very reliable with elders. His number is in Community > Auto & Taxi.', 4),
    reply(6, familyId, 'Booked him for Thursday. Thank you!', 7),
    reply(8, u.raghavan, 'The Corporation health inspector has been informed. Fogging is scheduled for this weekend.', 20),
    reply(8, u.george, 'Fogging was done on Saturday. Thank you for acting so quickly.', 70),
    reply(9, u.haridas, 'The float valve has been replaced.', 28),
    reply(10, u.raghavan, 'KSEB has trimmed the branch. Thank you for reporting.', 30),
    reply(11, u.mini, 'Done — she is registered at the gate with a permanent pass.', 10),
    reply(11, u.kamini, 'Thank you, this saves us a lot of trouble.', 14),
    reply(13, u.mini, 'We have saved the number of the forest department’s snake rescue team in the helplines.', 20),
    reply(14, u.mini, 'The watchman now keeps a delivery register at the gate.', 15),
    reply(15, u.haridas, 'A new LED light has been fitted at the corner.', 50),
  ];
  await prisma.committeeQueryReply.createMany({ data: replies });
  tally.add('Queries and help-desk tickets', queries.length + replies.length);

  // ─── WhatsApp groups and chat ────────────────────────────────────────────
  await prisma.whatsAppGroupLink.createMany({
    data: [
      { neighborhoodId: nId, name: 'Kowdiar Gardens — Announcements', description: 'Official notices from the committee. (Demo link — replace with your group’s invite.)', inviteUrl: 'https://chat.whatsapp.com/DemoKowdiarAnnounce', createdById: u.mini, createdAt: at(-98) },
      { neighborhoodId: nId, name: 'Road 3 Neighbours', description: 'Friendly chat for Road 3. (Demo link.)', inviteUrl: 'https://chat.whatsapp.com/DemoRoad3Neighbours', createdById: u.raghavan, createdAt: at(-94) },
      { neighborhoodId: nId, name: 'Kowdiar Park Walkers', description: 'Coordinate the 6 AM walk at Kowdiar Park. (Demo link.)', inviteUrl: 'https://chat.whatsapp.com/DemoParkWalkers', createdById: u.basheer, createdAt: at(-80) },
      { neighborhoodId: nId, name: 'Seniors’ Buddy Circle', description: 'Seniors and volunteers who check in on each other. (Demo link.)', inviteUrl: 'https://chat.whatsapp.com/DemoSeniorsBuddy', createdById: u.anjana, createdAt: at(-60) },
      { neighborhoodId: nId, name: 'Festival Volunteers', description: 'Planning pookalam, decorations and food for community festivals. (Demo link.)', inviteUrl: 'https://chat.whatsapp.com/DemoFestivalVolunteers', createdById: u.sheela, createdAt: at(-30) },
    ],
  });

  const pool = [
    'Good morning everyone! Lovely weather for a walk at Kowdiar Park today.', 'Reminder: water supply will be off tomorrow morning, please store water.', 'Has anyone seen a grey cat near the community hall? A child is looking for it.',
    'Thank you to whoever got the street light fixed on Road 3, much safer now!', 'Bhajan sandhya this Thursday at 6:30 PM. All are welcome.', 'Can anyone recommend a good electrician? Our fan is making a noise.',
    'The coconut climber is coming on Saturday. Anyone else who wants their trees done?', 'Walking group meets at 6 AM near the park gate. Join us!', 'Lost: a small brown umbrella near the gate. Please check.',
    'Please keep the road frontage clear for the garbage collectors.', 'The bakery near the junction has sugar-free cakes now, in case anyone needs.', 'Heavy rain expected tonight. Please secure your gates and clear the drains.',
    'Looking for a reliable part-time cook, please message me.', 'Thank you Rahul for helping me with the phone setup. Very kind!', 'Fresh fish arriving at the junction at 7 AM tomorrow.',
    'Chess club tonight at 7 at the community hall.', 'The pharmacy near the junction delivers free for seniors. Just call them.', 'Please do not feed the stray dogs near the gate after dark.',
    'Anyone going to the Padmanabhaswamy temple this Friday? We can share an auto.', 'Reminder: monthly subscription is due by the 10th.', 'The KWA tanker has arrived. Collecting at the community hall.',
    'Wishing everyone a peaceful and healthy week.', 'Can someone help me carry two water cans? Thank you!', 'Our night watchman has been very helpful. Appreciate it.',
    'Free health camp for seniors next week. Please register at the community hall.', 'Our volunteer group is happy to accompany anyone to a hospital visit. Just message.', 'Is there a plumber who can come today? Kitchen tap is leaking.',
    'Happy to lend my walker to anyone who needs it for a few weeks.', 'The community hall is free on Saturday evening if anyone wants to host a get-together.', 'Nalla mazha! Everyone safe? Please check on the elders on your road.',
  ];
  const scripted: Array<[string, string, number]> = [
    [u.girija, 'Good morning everyone! Beautiful weather for the walk at the park today.', 52],
    [u.george, 'Morning Girija. Joining you at 6:30.', 51],
    [elderId, 'Good morning. I will come to the park gate after my tea.', 50],
    [u.mini, 'Reminder: KWA supply will be off this Saturday. Please store water.', 30],
    [u.annamma, 'Thank you Mini. Will the tanker come for Road 4 also?', 29],
    [u.mini, 'Yes, Road 4 too. Details on the notice board.', 29],
    [u.rahul, 'Anyone need help carrying water on Saturday? I am free in the morning.', 28],
    [elderId, 'That is kind of you, Rahul. I may need help with two cans.', 27],
    [u.rahul, 'Of course, ammae. I will come at 9:30.', 27],
    [u.sheela, 'Navaratri pooja starts tomorrow at 6:30 PM at the community hall. Do come!', 20],
    [u.fathima, 'I will help with the prasad.', 19],
    [u.girija, 'Wonderful. Devaki, you will sing the Narayaneeyam verses on the first day?', 18],
    [elderId, 'Only if you all sing along.', 17],
    [u.francis, 'Has anyone seen a small brown umbrella near the community hall?', 12],
    [u.anjana, 'I think I saw it at the watchman’s room, Francis uncle.', 11],
    [u.francis, 'Found it. Thank you!', 10],
    [familyId, 'Reminder: health camp for seniors this Thursday. Please register at the community hall.', 6],
    [u.haridas, 'Subscription for this month is open on the Fees page. Online payment is now available.', 4],
    [u.venkatesh, 'Good evening all. Chess club tonight at 7.', 2],
  ];
  const chat: Prisma.ChatMessageCreateManyInput[] = scripted.map(([senderId, body, h]) => ({ neighborhoodId: nId, senderId, body, createdAt: hoursAgo(h) }));
  for (let d = 88; d >= 3; d--) {
    const count = rng.chance(0.2) ? 0 : rng.int(1, d % 7 === 0 || d % 7 === 6 ? 5 : 3);
    for (let i = 0; i < count; i++) {
      const eligible = residents.filter((uid) => joinedAt.get(uid)! < at(-d).getTime());
      if (eligible.length === 0) continue;
      chat.push({ neighborhoodId: nId, senderId: rng.pick(eligible), body: rng.pick(pool), createdAt: at(-d, `${String(rng.int(6, 21)).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}`) });
    }
  }
  await prisma.chatMessage.createMany({ data: chat });
  tally.add('WhatsApp groups and chat messages', 5 + chat.length);

  // ─── Marketplace and jobs ────────────────────────────────────────────────
  const mk = (d: number, by: string, rest: Omit<Prisma.MarketplaceListingCreateManyInput, 'neighborhoodId' | 'postedById' | 'houseNumber' | 'contactPhone' | 'createdAt'>) =>
    ({ neighborhoodId: nId, postedById: by, houseNumber: houseOf(Object.keys(u).find((k) => u[k] === by)!), contactPhone: phoneOf(Object.keys(u).find((k) => u[k] === by)!), createdAt: at(-d, '12:00'), ...rest });
  await prisma.marketplaceListing.createMany({
    data: [
      mk(2, u.george, { listingType: 'sell', title: 'Teak easy chair (rocking chair)', description: 'Solid teak with a cane seat. Moving to a smaller house.', price: 6500, priceUnit: 'one-time', imagePath: '/demo/market/sofa.svg', preferredContactTime: 'Evenings' }),
      mk(4, u.venkatesh, { listingType: 'sell', title: 'Treadmill, lightly used', description: 'Barely used. Adjustable incline and a heart-rate display.', price: 9500, priceUnit: 'one-time', imagePath: '/demo/market/bicycle.svg' }),
      mk(5, u.francis, { listingType: 'lend', title: 'Folding walker available to lend', description: 'Lightweight aluminium walker. Free to borrow during recovery — please return when done.', imagePath: '/demo/market/walker.svg' }),
      mk(8, u.girija, { listingType: 'sell', title: 'Collection of Malayalam novels', description: 'Thirty classic Malayalam novels in good condition.', price: 1200, priceUnit: 'one-time', imagePath: '/demo/market/books.svg' }),
      mk(1, u.annamma, { listingType: 'wanted', title: 'Looking for a second-hand wheelchair', description: 'For a relative recovering from surgery. Happy to rent for a month.' }),
      mk(12, u.rahul, { listingType: 'rent', title: 'Projector for rent', description: 'HD projector for movie nights or presentations. Includes HDMI cable.', price: 300, priceUnit: 'per day' }),
      mk(15, u.mini, { listingType: 'sell', title: 'Wet grinder, 2 litre', description: 'Works perfectly for idli and dosa batter. One year old.', price: 3200, priceUnit: 'one-time', status: 'reserved' }),
      mk(18, u.fathima, { listingType: 'lend', title: 'Large uruli and idli steamer', description: 'Happy to lend for festival cooking and sadya preparations.' }),
      mk(9, u.sheela, { listingType: 'sell', title: 'Homemade banana chips and unniyappam', description: 'Fresh, made in coconut oil. Order by Friday for Saturday delivery on our road.', price: 320, priceUnit: 'per kg' }),
      mk(14, u.haridas, { listingType: 'sell', title: 'Pure coconut oil from our own trees, 1 litre', description: 'Cold-pressed in the village mill. Bring your own bottle or I will send one.', price: 340, priceUnit: 'per litre' }),
      mk(24, u.kamini, { listingType: 'sell', title: 'Steel almirah, 2-door', description: 'Sturdy, with a lock and two shelves. Pick-up only.', price: 3000, priceUnit: 'one-time', status: 'closed' }),
      mk(33, u.raghavan, { listingType: 'sell', title: 'Ceiling fans (set of 3)', description: 'Five-star rated, one year old. Selling as a set.', price: 4500, priceUnit: 'one-time', status: 'closed' }),
      mk(40, u.basheer, { listingType: 'rent', title: 'Folding massage chair', description: 'Comfortable chair for back pain. Rent by the week.', price: 600, priceUnit: 'per week' }),
      mk(55, u.biju, { listingType: 'sell', title: 'Wooden study table', description: 'Solid wood with two drawers.', price: 3500, priceUnit: 'one-time', status: 'closed' }),
    ],
  });
  const jb = (d: number, by: string, rest: Omit<Prisma.CommunityJobPostingCreateManyInput, 'neighborhoodId' | 'postedById' | 'houseNumber' | 'contactPhone' | 'createdAt'>) => {
    const key = Object.keys(u).find((k) => u[k] === by);
    const person = NEIGHBOURS.find((n) => n.key === key);
    return { neighborhoodId: nId, postedById: by, houseNumber: person?.house ?? FAMILY.house, contactPhone: person?.phone ?? FAMILY.phone, createdAt: at(-d, '11:00'), ...rest };
  };
  await prisma.communityJobPosting.createMany({
    data: [
      jb(2, u.francis, { postingType: 'job_offered', title: 'Part-time cook for an elderly couple', description: 'Simple Kerala vegetarian and fish meals, low salt. Two hours in the morning.', compensation: 'Rs 9,000 per month' }),
      jb(6, u.sheela, { postingType: 'job_offered', title: 'House help, 2 hours daily', description: 'Sweeping, mopping and dusting. Mornings preferred.', compensation: 'Rs 6,000 per month' }),
      jb(10, u.anjana, { postingType: 'job_wanted', title: 'Experienced attendant seeking night shifts', description: 'Referred by two families in the association. Comfortable with bedridden patients.', compensation: 'Negotiable' }),
      jb(14, u.venkatesh, { postingType: 'resource_offered', title: 'Maths and English tuition for classes 8 to 10', description: 'Retired school teacher offering evening tuition at home.', compensation: 'Rs 400 per hour' }),
      jb(1, familyId, { postingType: 'resource_wanted', title: 'Companion for evening walks', description: 'Looking for a kind volunteer or paid companion for a gentle evening walk, three days a week.', compensation: 'Rs 300 per walk' }),
      jb(21, u.kamini, { postingType: 'job_offered', title: 'Driver for hospital visits, Thursdays', description: 'A reliable driver with a car for a weekly hospital visit.', compensation: 'Rs 800 per trip', status: 'closed' }),
      jb(30, u.abhijith, { postingType: 'resource_offered', title: 'Free help with smartphone and UPI setup', description: 'Happy to sit with seniors and set up WhatsApp, video calls and payments. Many of you have children abroad — let us make those calls easy.', compensation: 'Free' }),
      jb(45, u.biju, { postingType: 'job_wanted', title: 'Looking for a part-time accounts job', description: 'Ten years of experience in small-business accounts.', compensation: 'Negotiable', status: 'closed' }),
      jb(58, u.basheer, { postingType: 'resource_wanted', title: 'Need a carpenter for grab bars', description: 'Two grab bars in the bathroom for an elderly parent.', compensation: 'As per quote', status: 'closed' }),
      jb(7, u.haridas, { postingType: 'job_offered', title: 'Coconut climber needed every two months', description: 'For six coconut trees in the compound. Regular work.', compensation: 'Rs 50 per tree' }),
    ],
  });
  tally.add('Marketplace and jobs', 24);

  // ─── Documents ───────────────────────────────────────────────────────────
  await prisma.communityDocument.createMany({
    data: [
      { neighborhoodId: nId, title: 'Association bye-laws', category: 'bylaws', fileName: 'bylaws.pdf', filePath: '/demo/docs/bylaws.pdf', fileType: 'application/pdf', uploadedById: u.mini, createdAt: at(-98) },
      { neighborhoodId: nId, title: 'AGM minutes — July 2026', category: 'minutes', fileName: 'agm-minutes.pdf', filePath: '/demo/docs/agm-minutes.pdf', fileType: 'application/pdf', uploadedById: u.mini, createdAt: at(-75) },
      { neighborhoodId: nId, title: 'Monsoon and fire safety circular', category: 'other', fileName: 'fire-safety.pdf', filePath: '/demo/docs/fire-safety.pdf', fileType: 'application/pdf', uploadedById: u.mini, createdAt: at(-34) },
      { neighborhoodId: nId, title: 'KWA supply interruption notice', category: 'notice', fileName: 'water-tank-notice.pdf', filePath: '/demo/docs/water-tank-notice.pdf', fileType: 'application/pdf', uploadedById: u.haridas, createdAt: at(-1) },
    ],
  });

  // ─── Fees: monthly subscription, a street-light fund and an Onam fund ────
  const feeMonthly = newId();
  const feeLights = newId();
  const feeOnam = newId();
  await prisma.communityFee.createMany({
    data: [
      { id: feeMonthly, neighborhoodId: nId, label: 'Monthly subscription', defaultAmount: 1500, frequency: 'monthly', createdById: u.haridas, createdAt: at(-100) },
      { id: feeLights, neighborhoodId: nId, label: 'LED street light and CCTV fund', defaultAmount: 3000, frequency: 'one_time', createdById: u.haridas, createdAt: at(-64) },
      { id: feeOnam, neighborhoodId: nId, label: 'Onam fund 2026', defaultAmount: 500, frequency: 'one_time', createdById: u.sheela, createdAt: at(-60) },
    ],
  });
  const earlyPayers = new Set([familyId, u.mini, u.haridas, u.sheela, u.girija, u.abhijith, u.george, u.rahul]);
  const overdue = new Set([u.annamma, u.francis]);
  const charges: Prisma.FeeChargeCreateManyInput[] = [];
  const addCharge = (feeId: string, userId: string, period: string, due: Date, amount: number, paid: boolean) => {
    const fee = paid ? Math.round(amount * 0.05 * 100) / 100 : null;
    charges.push({
      communityFeeId: feeId, neighborhoodMemberId: memberId[userId], residentUserId: userId, period, amount, dueDate: due,
      status: paid ? 'paid' : 'due',
      razorpayPaymentId: paid ? `pay_demo_${newId().slice(0, 12)}` : null,
      paidAt: paid ? new Date(Math.min(due.getTime() - rng.int(1, 6) * 86_400_000, Date.now() - 5 * 3_600_000)) : null,
      paidByUserId: paid ? (userId === elderId ? familyId : userId) : null,
      platformFeeAmount: fee, netAmountForAssociation: fee === null ? null : amount - fee,
    });
  };
  for (let back = 3; back >= 0; back--) {
    const { period, due } = billingPeriod(back);
    for (const uid of residents) {
      if (joinedAt.get(uid)! > due.getTime()) continue;
      const paid = back >= 2 ? !(back === 2 && rng.chance(0.04)) : back === 1 ? !overdue.has(uid) : earlyPayers.has(uid);
      addCharge(feeMonthly, uid, period, due, 1500, paid);
    }
  }
  for (const uid of residents) addCharge(feeLights, uid, 'one-time', at(20), 3000, [familyId, u.mini, u.haridas, u.raghavan, u.venkatesh, u.sheela, u.girija, u.rahul, u.abhijith].includes(uid));
  for (const uid of residents) addCharge(feeOnam, uid, 'one-time', at(-48), 500, ![u.francis, u.kamini].includes(uid));
  await prisma.feeCharge.createMany({ data: charges });
  tally.add('Subscriptions and fund charges', 3 + charges.length);

  const exp = (daysBack: number, label: string, amount: number, category: string, by: string, notes?: string) =>
    ({ neighborhoodId: nId, label, amount, category, spentOn: at(-daysBack), addedById: by, notes: notes ?? null, createdAt: at(-daysBack) });
  const expenses: Prisma.AssociationExpenseCreateManyInput[] = [];
  for (const base of [3, 33, 63, 93]) {
    expenses.push(
      exp(base, 'Night watchman — salary', 9000, 'Security', u.haridas),
      exp(base + 2, 'Street light electricity', rng.int(2600, 3100), 'Electricity', u.haridas, 'KSEB bill for the common street lights.'),
      exp(base + 4, 'Haritha Karma Sena and waste handling', 1800, 'Housekeeping', u.haridas),
      exp(base + 6, 'Common ground and park upkeep', 2200, 'Garden', u.haridas),
    );
  }
  expenses.push(
    exp(20, 'Drain desilting before the monsoon', 6500, 'Repairs', u.haridas), exp(36, 'Road patchwork on Road 2', 8000, 'Repairs', u.haridas),
    exp(31, 'Tree trimming near the KSEB lines', 5200, 'Safety', u.haridas), exp(44, 'Borewell pump repair', 7800, 'Water', u.haridas),
    exp(55, 'CCTV annual maintenance', 3000, 'Security', u.raghavan), exp(46, 'Onam celebration: flowers, sadya and prizes', 14500, 'Events', u.sheela, 'Part funded by the Onam fund.'),
    exp(62, 'Independence Day decoration', 1500, 'Events', u.sheela), exp(26, 'Vinayaka Chaturthi decoration and prasad', 4200, 'Events', u.sheela),
    exp(12, 'Mosquito fogging', 3500, 'Housekeeping', u.haridas), exp(9, 'Portable ramp for the community hall', 5200, 'Repairs', u.haridas, 'Requested by a resident; permanent ramp pending.'),
  );
  await prisma.associationExpense.createMany({ data: expenses });
  tally.add('Association expenses', expenses.length);

  // ─── Hobby and interest groups ───────────────────────────────────────────
  const hobbyDefs = [
    { key: 'bhajan', name: 'Bhajan Mandali', category: 'music' as const, description: 'Devotional singing and Narayaneeyam reading every Thursday evening at the community hall.', by: u.girija, d: 90 },
    { key: 'chess', name: 'Kowdiar Chess Club', category: 'other' as const, description: 'Friendly games every evening at 7. All levels welcome.', by: u.venkatesh, d: 85 },
    { key: 'pookalam', name: 'Pookalam and Craft Circle', category: 'art' as const, description: 'Pookalam, rangoli, paper craft and card-making with the children.', by: u.sheela, d: 80 },
    { key: 'books', name: 'Book Club (Malayalam and English)', category: 'books' as const, description: 'One book a month. Discussion on the first Sunday over tea.', by: u.fathima, d: 72 },
    { key: 'walkers', name: 'Kowdiar Park Walkers', category: 'other' as const, description: 'A 6 AM walk at Kowdiar Park followed by light stretching.', by: u.basheer, d: 78 },
    { key: 'nadakam', name: 'Nadakam (Street Play Group)', category: 'theatre' as const, description: 'A small group rehearsing a short play for the Kerala Piravi programme.', by: u.anjana, d: 30 },
  ].map((h) => ({ ...h, id: newId() }));
  await prisma.hobbyGroup.createMany({ data: hobbyDefs.map((h) => ({ id: h.id, neighborhoodId: nId, name: h.name, category: h.category, description: h.description, createdById: h.by, createdAt: at(-h.d) })) });
  const hobbyMembers = new Map<string, Set<string>>();
  const joinHobby = (key: string, userId: string) => hobbyMembers.set(key, (hobbyMembers.get(key) ?? new Set()).add(userId));
  for (const n of NEIGHBOURS) for (const h of n.hobbies ?? []) joinHobby(h, u[n.key]);
  for (const k of ['bhajan', 'books', 'walkers']) joinHobby(k, elderId);
  joinHobby('chess', familyId);
  joinHobby('nadakam', u.rahul);
  joinHobby('nadakam', u.sheela);
  for (const h of hobbyDefs) joinHobby(h.key, h.by);
  const hobbyRows = [...hobbyMembers.entries()].flatMap(([key, set]) => [...set].map((userId) => ({ hobbyGroupId: hobbyDefs.find((h) => h.key === key)!.id, userId, joinedAt: at(-rng.int(5, 70)) })));
  await prisma.hobbyGroupMember.createMany({ data: hobbyRows });
  tally.add('Hobby groups and members', hobbyDefs.length + hobbyRows.length);

  // ─── Vendors directory ───────────────────────────────────────────────────
  const listing = (name: string, category: string, phone: string, tags: Record<string, string>, description: string, daysAgo: number, address?: string) =>
    ({ id: newId(), neighborhoodId: nId, name, category, phone, description, address: address ?? null, addedById: u.mini, verified: true, createdAt: at(-daysAgo), ...tags });
  const pharmacyListing = { ...listing('Dhanwantari Pharmacy', 'Pharmacy', '9446021785', { shopCategory: 'medical_store' }, 'Medicines, health devices and free home delivery for residents. Monthly refill reminders.', 96, 'TC 9/1187, Kowdiar Junction'), addedById: p.providerUserId };
  const vendors = [
    listing('Shankaran Plumbing Works', 'Plumber', '9446271365', { homeMaintenanceCategory: 'leakage' }, 'Leakage repair, tap and pipe fitting. Same-day visits.', 90),
    listing('Vijayan Electricals', 'Electrician', '9447162073', { homeMaintenanceCategory: 'electrical' }, 'Wiring, switches, fans and inverter servicing.', 90),
    listing('Leela Home Help', 'House help', '9744628305', { homeMaintenanceCategory: 'maid' }, 'Trusted daily and weekly cleaning help.', 88),
    listing('Annapurna Home Cooks', 'Cook', '9447509172', { homeMaintenanceCategory: 'cook' }, 'Home cooks for Kerala meals, diabetic and low-salt diets.', 86),
    listing('Prasad Painters', 'Painter', '9846403715', { homeMaintenanceCategory: 'painting' }, 'Interior painting and waterproofing.', 82),
    listing('Appu — Coconut climber', 'Coconut climber', '9946064183', { homeMaintenanceCategory: 'gardening' }, 'Climbs and clears coconut and areca trees. Also cuts overhanging branches.', 79),
    listing('Raju Carpentry', 'Carpenter', '9847617284', { homeMaintenanceCategory: 'carpentry' }, 'Furniture repair and grab-bar installation.', 75),
    listing('Haritha Karma Sena — Ward 14', 'Waste collection', '9447090016', { homeMaintenanceCategory: 'cleaning' }, 'Door-to-door collection of non-biodegradable waste on the first Saturday of every month.', 70),
    listing('Nanma Medicals', 'Medical store', '9447617035', { shopCategory: 'medical_store' }, 'Open till 10 PM. Home delivery on call.', 85),
    listing('Pattom Supermarket', 'Supermarket', '9846603172', { shopCategory: 'supermarket' }, 'Groceries and household items. Senior discount on Wednesdays.', 85),
    listing('Ruchi Bakery', 'Bakery', '9895251740', { shopCategory: 'bakery' }, 'Fresh bread, sugar-free cakes, plantain chips and snacks.', 70),
    listing('Kowdiar Stationery', 'Stationery', '9744295631', { shopCategory: 'stationery' }, 'Books, stationery and photocopying.', 70),
    listing('Hardware & Electricals Centre', 'Hardware', '9591370826', { shopCategory: 'hardware_store' }, 'Tools, paints and plumbing fittings.', 66),
    listing('Karuna Home Nursing', 'Home nursing', '9496253718', { elderCareCategory: 'home_nursing' }, 'Trained nurses and attendants for home care.', 80),
    listing('Thanal Companions', 'Companion care', '9744198362', { elderCareCategory: 'companion_service' }, 'Friendly companions for walks, temple visits and hospital visits.', 52),
    listing('MoveWell Physio at Home', 'Physiotherapy', '9847561390', { elderCareCategory: 'home_treatment' }, 'Home physiotherapy for balance, joint pain and recovery.', 64),
  ];
  await prisma.localListing.createMany({ data: [pharmacyListing, ...vendors] });
  const vid = (name: string) => vendors.find((v) => v.name === name)!.id;
  await prisma.communityProviderListing.createMany({
    data: [
      { providerId: prov.id.pharmacy, neighborhoodId: nId, status: 'approved', communityApprovedAt: at(-96), communityApprovedById: u.mini, platformApprovedAt: at(-95), platformApprovedById: p.adminId, localListingId: pharmacyListing.id, createdAt: at(-97) },
      { providerId: prov.id.nursing, neighborhoodId: nId, status: 'approved', communityApprovedAt: at(-80), communityApprovedById: u.mini, platformApprovedAt: at(-79), platformApprovedById: p.adminId, localListingId: vid('Karuna Home Nursing'), createdAt: at(-81) },
      { providerId: prov.id.companion, neighborhoodId: nId, status: 'approved', communityApprovedAt: at(-52), communityApprovedById: u.mini, platformApprovedAt: at(-51), platformApprovedById: p.adminId, localListingId: vid('Thanal Companions'), createdAt: at(-53) },
      { providerId: prov.id.physio, neighborhoodId: nId, status: 'approved', communityApprovedAt: at(-64), communityApprovedById: u.mini, platformApprovedAt: at(-63), platformApprovedById: p.adminId, localListingId: vid('MoveWell Physio at Home'), createdAt: at(-65) },
      { providerId: prov.id.grocery, neighborhoodId: nId, status: 'communityApproved', communityApprovedAt: at(-2), communityApprovedById: u.mini, createdAt: at(-4) },
      { providerId: prov.id.property, neighborhoodId: nId, status: 'pending', createdAt: at(-1) },
    ],
  });
  tally.add('Vendors and provider approvals', vendors.length + 7);

  // ─── Volunteers ──────────────────────────────────────────────────────────
  const volunteers = NEIGHBOURS.filter((n) => n.volunteer).map((n) => ({ userId: u[n.key], availability: n.volunteer!.availability, types: n.volunteer!.types, status: n.volunteer!.status ?? ('verified' as const), joined: n.joined }));
  await prisma.volunteerProfile.createMany({
    data: volunteers.map((v) => ({ userId: v.userId, availability: v.availability, assistanceTypes: v.types, verificationStatus: v.status, isActive: true, createdAt: at(-Math.max(v.joined - 5, 3)) })),
  });
  tally.add('Community volunteers', volunteers.length);

  // ─── Doctors and auto drivers of the association ─────────────────────────
  const drProvider = { id: newId(), name: 'Dr. Latha Varma', clinicName: 'Varma Family Clinic', specialty: 'General medicine and geriatrics', qualifications: 'MBBS, MD (Medicine), PG Diploma in Geriatric Medicine', background: 'Over fifteen years caring for senior citizens in Kowdiar. Offers home visits for those who cannot travel.', locality: 'Kowdiar', lat: 8.5208, lng: 76.9576, phone: '9847103265', fee: 600, providerId: prov.id.doctor, addedById: p.support.doctor };
  const doctors = [drProvider, ...LEGACY_DOCTORS.map((d) => ({ id: newId(), name: d.name, clinicName: d.clinicName, specialty: d.specialty, qualifications: d.qualifications, background: d.background, locality: d.locality, lat: d.lat, lng: d.lng, phone: d.phone, fee: d.fee, providerId: null as string | null, addedById: u.mini }))];
  await prisma.localDoctor.createMany({
    data: doctors.map((d) => ({
      id: d.id, neighborhoodId: nId, name: d.name, clinicName: d.clinicName, specialty: d.specialty, qualifications: d.qualifications, background: d.background,
      locality: d.locality, lat: d.lat, lng: d.lng, mapsLink: `https://maps.google.com/?q=${d.lat},${d.lng}`, phone: d.phone, consultationFee: d.fee, providerId: d.providerId,
      addedById: d.addedById, isActive: true, photoPath: d.name.includes('Latha') ? '/demo/people/doctor.svg' : d.name.includes('Joseph') ? '/demo/people/drjoseph.svg' : '/demo/people/drshamina.svg', createdAt: at(-85),
    })),
  });

  // ─── Local directory: bulk-added residents, a match to review, house pins ─
  const dir = (name: string, phone: string | null, house: string, extra: Record<string, unknown> = {}) => ({ id: newId(), neighborhoodId: nId, name, phone, flatNumber: house, importedById: p.adminId, createdAt: at(-30), ...extra });
  const placeholders = [
    dir('Hari Narayanan', '9744530286', 'KGRA-1'),
    dir('Zainaba Beevi', '9847437021', 'KGRA-20', { invitedAt: at(-28) }),
    dir('Narayanan Namboothiri', '9447720153', 'Madhavam', { invitedAt: at(-28) }),
    dir('Savithri Amma', null, 'KGRA-13'),
    dir('Dr. Ashok Verma', '9895286471', 'KGRA-45', { invitedAt: at(-27) }),
    dir('Parvathi Kutty', '9846731620', 'KGRA-8', { invitedAt: at(-27) }),
    dir('Jose Mathew', '9446427036', 'KGRA-26'),
    dir('Lalitha Kumari', '9744104857', 'KGRA-19'),
    dir('Venkat S.', '9446618295', 'KGRA-22'),
  ];
  await prisma.unregisteredResident.createMany({ data: placeholders });
  await prisma.directoryMatchSuggestion.create({
    data: { neighborhoodId: nId, placeholderId: placeholders[8].id, userId: u.venkatesh, reason: 'house_and_name', score: 0.88, createdAt: at(-2) },
  });
  const pinned = [ELDER.house, FAMILY.house, ...NEIGHBOURS.slice(0, 12).map((n) => n.house)];
  await prisma.houseLocation.createMany({
    data: pinned.map((house) => {
      const [lat, lng] = pinFor(house);
      return { neighborhoodId: nId, houseKey: houseKey(house), house, lat, lng, setById: house === ELDER.house || house === FAMILY.house ? familyId : u.mini, setByRole: 'committee', createdAt: at(-60) };
    }),
  });
  tally.add('Local directory (bulk-added residents, match review, house pins)', placeholders.length + 1 + pinned.length);

  // ─── Neighbours: favourites, hellos, preferences, past panic alerts ──────
  await prisma.neighborFavorite.createMany({
    data: [
      { userId: elderId, neighborhoodId: nId, entryKey: `member:${u.mini}` },
      { userId: elderId, neighborhoodId: nId, entryKey: `member:${u.abhijith}` },
      { userId: elderId, neighborhoodId: nId, entryKey: `member:${u.girija}` },
      { userId: familyId, neighborhoodId: nId, entryKey: `member:${u.abhijith}` },
      { userId: familyId, neighborhoodId: nId, entryKey: `member:${u.mini}` },
    ],
  });
  const hello = (from: string, to: string, message: string, hAgo: number, read: boolean) => ({ neighborhoodId: nId, fromUserId: from, toUserId: to, message, readAt: read ? hoursAgo(hAgo - 1) : null, createdAt: hoursAgo(hAgo) });
  await prisma.greeting.createMany({
    data: [
      hello(u.girija, elderId, 'Good morning, Devaki! See you at the park.', 1.2, false),
      hello(u.fathima, elderId, 'Thinking of you. Hope the knee is better.', 30, true),
      hello(elderId, u.george, 'Thank you for the chess game yesterday!', 44, true),
      hello(u.abhijith, familyId, 'Happy to take Amma for her hospital visit on Thursday.', 8, true),
      hello(u.anjana, elderId, 'Dropping by with some prasad this evening.', 70, true),
      hello(elderId, u.girija, 'Wonderful bhajans on Thursday. Thank you for the harmonium.', 96, true),
      hello(u.mini, familyId, 'Thank you for helping with the health camp registration.', 120, true),
      hello(u.rahul, elderId, 'Your phone is all set, ammae. Call me if anything acts up.', 200, true),
      hello(u.kamini, elderId, 'Would you like to join the book club on Sunday?', 260, true),
      hello(u.sheela, familyId, 'Could you please help with the Navaratri stage setup?', 300, true),
    ],
  });
  const prefs = (userId: string) => ['announcements', 'events', 'chat', 'greetings', 'queries'].map((category) => ({ userId, category, push: category !== 'chat', email: category === 'announcements' }));
  await prisma.notificationPreference.createMany({ data: [...prefs(elderId), ...prefs(familyId)] });
  const panic = (d: number, hhmm: string, by: string, house: string, ack: string, resolvedMin: number) => ({
    userId: by, triggerType: 'community_panic', neighborhoodId: nId, lat: DEMO_LAT, lng: DEMO_LNG, address: addressOf(house),
    status: 'resolved', acknowledgedBy: ack, createdAt: at(d, hhmm), resolvedAt: new Date(at(d, hhmm).getTime() + resolvedMin * 60_000),
  });
  await prisma.sOSEvent.createMany({ data: [panic(-19, '19:12', elderId, ELDER.house, u.mini, 18), panic(-41, '03:20', u.francis, houseOf('francis'), u.abhijith, 25)] });
  tally.add('Neighbours (favourites, hellos, preferences, past panic alerts)', 5 + 10 + 10 + 2);

  return { neighborhoodId: nId, memberId, doctorIds: doctors.map((d) => d.id) };
}
