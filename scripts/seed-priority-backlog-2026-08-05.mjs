import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// User-requested priority batch (2026-08-05) — placed ahead of every existing backlog
// card via negative position values. Item 1 (edit profile / change password) is
// recorded as 'done' — it shipped this session (feat/profile-password, merged to
// dev, pending the main deploy) rather than added as a pending card.

const DONE_ITEM = {
  title: 'Edit profile + change password',
  description:
    'Built 2026-08-05 (feat/profile-password, merged to dev): shared ChangePasswordCard across all four portals; editable name/email/phone on elder, family, admin; a distinct "your account" section on the provider portal. Live once the pending dev→main merge deploys.',
  status: 'done',
  priority: 'high',
};

const PENDING_ITEMS = [
  {
    title: 'Validate email address and phone number format',
    description:
      'Registration and profile-edit forms accept any string for email/phone today — email only gets a loose zod .email() check at registration, phone has no format check anywhere. Add real format validation (proper email regex, Indian phone format) on both register and PUT /auth/me. Separate, larger question: true verification (confirm the address/number is actually reachable via an OTP or confirmation link) needs an SMS/email provider decision first — same category of blocker as the OTP gap already on record. Building format validation now; flagging live verification as its own follow-up needing that provider decision.',
    priority: 'high',
  },
  {
    title: 'Publish own contact number to directory + delete',
    description:
      "Two related gaps, one already half-solved: (1) the neighbours-directory-sharing feature built 2026-08-05 already lets an elder/family opt a personal contact into the community directory with edit/delete — done. (2) Missing: NeighborhoodMember.showInDirectory already exists in the schema and is read by the directory API, but there's no UI anywhere for a resident to toggle their own registered listing on/off. Add that toggle (likely on /community/settings or the profile page).",
    priority: 'high',
  },
  {
    title: 'Health — yoga/exercise/meditation centre (admin-curated YouTube links)',
    description:
      "New feature: a curated list of yoga/exercise/meditation content, admin-published (link + title + thumbnail), elder-facing under Health. Same pattern as the existing admin-managed DailyQuote feature — reuse that model's shape (admin CRUD + public elder-facing read) rather than inventing a new one.",
    priority: 'high',
  },
  {
    title: 'Medicine box + appointment reminders — fix + doctor-duration + caregiver edit',
    description:
      "Confirmed root-cause bug: POST /api/v1/health/reminders/generate exists but is called from nowhere in the app — medications never get today's reminders auto-created, so the elder's daily pill box silently stays empty past whatever day it was (never) manually generated. Fix: auto-generate on GET /reminders (self-healing, no cron needed) and right after a medication is created. Also add: Medication.endDate (optional — null means indefinite/ongoing, matches how lifelong meds like BP/diabetes meds actually work) so a doctor-recommended course auto-stops generating reminders once it ends, without deleting the record. Also: teach the prescription AI to parse the common Indian shorthand dosage notation (\"1-0-1\", \"1 0 0 1\" = morning-afternoon-evening-night, 1=take/0=skip) into timeSlots — today's prompt only handles descriptive phrases like \"twice daily\". Also: PATCH /api/v1/health/medications/[id] already exists and is caregiver-only server-side, but no UI anywhere calls it — add an edit form on the caregiver health page.",
    priority: 'high',
  },
  {
    title: 'Memories — shared family photo section',
    description:
      "New feature: a private photo-sharing space scoped to an elder + their linked family (FamilyRelation), not the community. Distinct from the separately-tracked Community Buzz photo albums, which are neighbourhood-scoped and social rather than family-private. New model needed.",
    priority: 'high',
  },
  {
    title: 'WhatsApp invite from admin (benefits summary + join link + association code)',
    description:
      "Reframed from the existing backlog card (which assumed a paid WhatsApp Business API account, hence [BLOCKED]): buildable now as a share-intent deep link (wa.me/?text=...) the same way the /services deep-link handoff already works for Swiggy/Zomato/etc. — admin composes a message (benefits summary + registration link + community join code), gets a pre-filled WhatsApp share link, and sends it themselves. No Business API, no per-message cost, no bulk-send infrastructure — just a share-intent generator.",
    priority: 'high',
  },
  {
    title: 'Voice: real speech-to-text + AI navigates/acts autonomously',
    description:
      "Two-part, and the second part needs a scope decision before building: (1) real microphone input — today's voice assistant is Claude-powered text-in/voice-out only, zero STT exists (confirmed: components/voice-assistant.tsx has no mic capture). Needs an STT choice (browser Web Speech API is free but has patchy multilingual support for kn/hi/ml; a paid STT service covers those better) — this part is buildable now. (2) \"autonomously completes the action on behalf of the elder\" — this means the AI doesn't just respond with text, it actually navigates pages and executes real actions (add a contact, book an appointment, etc.) without the elder tapping anything further. That's a real safety question for an elder-facing app, not just an engineering one: which actions are safe to fully auto-execute vs. which should show a confirm step first. Flagged to the user for a scope decision before implementation.",
    priority: 'high',
  },
];

async function main() {
  const doneMax = await prisma.backlogItem.aggregate({ where: { status: 'done' }, _max: { position: true } });
  const donePos = (doneMax._max.position ?? -1) + 1;

  const existingDone = await prisma.backlogItem.findFirst({ where: { title: DONE_ITEM.title } });
  if (existingDone) {
    console.log(`Skip (already exists): ${DONE_ITEM.title}`);
  } else {
    await prisma.backlogItem.create({ data: { ...DONE_ITEM, position: donePos } });
    console.log(`Created (done): ${DONE_ITEM.title}`);
  }

  // Negative positions so these sort ahead of every existing 'backlog' card
  // (the lowest pre-existing position was 0).
  let position = -PENDING_ITEMS.length;
  for (const item of PENDING_ITEMS) {
    const existing = await prisma.backlogItem.findFirst({ where: { title: item.title } });
    if (existing) {
      console.log(`Skip (already exists): ${item.title}`);
      position++;
      continue;
    }
    await prisma.backlogItem.create({
      data: { ...item, status: 'backlog', position },
    });
    console.log(`Created: ${item.title} (position ${position})`);
    position++;
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
