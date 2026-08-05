import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// New items from the 2026-08-05 pending-features review, filtered against the
// existing backlog so nothing already tracked gets duplicated (Banking/money-transfer,
// video calling, SOS-to-provider routing, diagnostics integrations, home automation,
// music player, and the STT half of voice control were all already present).
const ITEMS = [
  {
    title: 'Friends (Friendship model — connect, chat, presence)',
    description:
      "[MVP-priority, not yet built] Called out on 2026-07-31 as part of the revised Phase 1 MVP scope but never actually implemented — no Friendship model exists in the schema. Deliberately lightweight and separate from FamilyRelation: mutual opt-in (either side initiates, both must accept), and carries none of FamilyRelation's care/safety fields (canViewHealth, canManageMeds, receivesSos, receivesCheckin) — a friend is a social connection, never an emergency-notify or care-management relationship.",
    priority: 'high',
  },
  {
    title: 'ServiceRequest booking + assignment workflow',
    description:
      '[Phase C] What\'s built today (registration, verification, community connection, catalog, cart/checkout) covers a provider becoming a verified community vendor and selling fixed-price items. Still missing: a resident requesting a specific job ("come fix my tap"), it getting assigned to/accepted by a provider, and status tracked through completion — the actual ServiceRequest model and workflow.',
    priority: 'medium',
  },
  {
    title: 'Community documents (bylaws, AGM minutes, notices as files)',
    description:
      '[Phase A2+ Community Buzz] New CommunityDocument model — a file-upload library for society bylaws, AGM minutes, and other reference documents, distinct from time-ordered Notices.',
    priority: 'medium',
  },
  {
    title: 'Community Buzz — buy and sell marketplace',
    description:
      '[Phase A2+ Community Buzz] New MarketplaceListing model — neighbours listing items for sale within the community.',
    priority: 'medium',
  },
  {
    title: 'Community Buzz — photo albums',
    description:
      '[Phase A2+ Community Buzz] New PhotoAlbum + Photo models — shared community event/gathering photos.',
    priority: 'low',
  },
  {
    title: 'Community Buzz — hobby / interest groups',
    description:
      '[Phase A2+ Community Buzz] New HobbyGroup model + membership — interest-based sub-communities within a neighbourhood.',
    priority: 'low',
  },
  {
    title: 'Visitor management / security (gate pass, pre-approval, OTP/QR entry)',
    description:
      "[Phase A2+ Community Buzz — flagged separately] What both reference apps (Adda.io, MyGate) mean by \"security\" in this context — real-time gate-staff coordination, visitor pre-approval, delivery tracking, OTP/QR entry codes. Substantially more complex than the rest of Community Buzz combined; deliberately scoped as its own later phase with its own design pass once there's real signal it's wanted, not a sub-item to bundle in quickly.",
    priority: 'low',
  },
  {
    title: 'Chat media attachments + moderation tools',
    description:
      '[Phase D] Per-neighbourhood ChatMessage is live as plain text only. Richer chat/social means image/file attachments plus committee/admin moderation (delete, mute, report) — distinct from the separately-tracked external WhatsApp Business API integration.',
    priority: 'medium',
  },
  {
    title: 'Admin analytics dashboards',
    description:
      '[Phase D] Usage/engagement dashboards for the platform admin — adoption, active communities, SOS response times, provider activity, etc. Nothing built yet beyond the raw admin list/count pages.',
    priority: 'medium',
  },
  {
    title: 'Full responsive/accessibility audit',
    description:
      "[Phase D] A dedicated pass across every portal against the elder-first design bar (large touch targets, high contrast, screen-reader labels, coarse-pointer target sizing) rather than case-by-case fixes as pages get built.",
    priority: 'medium',
  },
];

async function main() {
  const maxPosition = await prisma.backlogItem.aggregate({
    where: { status: 'backlog' },
    _max: { position: true },
  });
  let position = (maxPosition._max.position ?? -1) + 1;

  for (const item of ITEMS) {
    const existing = await prisma.backlogItem.findFirst({ where: { title: item.title } });
    if (existing) {
      console.log(`Skip (already exists): ${item.title}`);
      continue;
    }
    await prisma.backlogItem.create({
      data: { ...item, status: 'backlog', position: position++ },
    });
    console.log(`Created: ${item.title}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
