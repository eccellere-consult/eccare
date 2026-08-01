import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ITEMS = [
  // ── Elder-comfort, dependency-free — highest priority ──────────────────
  {
    title: 'Speak-and-activate voice control',
    description:
      '[Phase D] Press-and-hold speak button that drives every app action by voice — user-stated #1 priority feature, zero external vendor dependency. Note: zero speech-to-text exists today (only TTS output via lib/voice.ts) — needs an STT library choice and likely a mobile dev-client rebuild. Multilingual support is a later iteration.',
    priority: 'high',
  },
  {
    title: 'Registration role selector (elder / family / community / provider / admin)',
    description:
      '[Phase A] Extend the public registration form to let the user pick their role at signup, gated appropriately (admin stays seed-only; provider requires a ServiceProvider profile in the same transaction, per the auth model).',
    priority: 'high',
  },
  {
    title: 'Doctor tagging + emergency directory (accept/open-hours/DND)',
    description:
      '[Phase A2] Extend the local/neighbours directory so doctors can be tagged for emergencies, with accept / set-open-hours / DND status they control themselves. Nearby hospital + specialist numbers surfaced alongside personal EmergencyContact.',
    priority: 'high',
  },
  {
    title: 'Vendor/LocalListing edit and delete',
    description:
      '[Phase A2] Prescription delete and medication PATCH/DELETE already exist. The real remaining gap is edit/delete for LocalListing (registered vendors) — currently create-and-list only.',
    priority: 'medium',
  },
  {
    title: 'Service provider portal + community portal depth',
    description:
      '[Phase C] Flesh out the ServiceProvider/ServiceRequest booking workflow and the community portal beyond directory+notices — incoming requests, status updates, onboarding.',
    priority: 'medium',
  },
  {
    title: 'Service provider approval workflow + certification/rating validation',
    description:
      '[Phase C] Admin/community verification queue for ServiceProvider sign-ups, with mandatory certification/proof upload and star ratings from users feeding into a visible trust score.',
    priority: 'medium',
  },
  {
    title: 'Emergency local shop catalog + running-low warnings',
    description:
      '[Phase A2/C] Order from a nearby store, notify the delivery person, source emergency medicines from nearby pharmacies, and warn the elder/family when medicines or groceries are running low.',
    priority: 'medium',
  },
  {
    title: 'Volunteers directory (neighbourhood help)',
    description:
      '[Phase A2+] Let neighbours register as volunteers willing to help elders nearby — extends the Community Buzz / neighbour-directory scope.',
    priority: 'medium',
  },
  {
    title: 'Curated health content and news',
    description:
      '[Phase D] Admin-shortlisted health videos (YouTube, Art of Living, Cult, etc.) for elders, plus curated health news and admin-shortlisted local news.',
    priority: 'medium',
  },
  {
    title: 'Subscription plans (paid family/provider, free for elders)',
    description:
      '[Phase F] Paid tiers for family users and service providers; elder accounts always free. Needs a payment-processing decision before checkout can be built, but the plan/tier data model and gating logic can be scoped independently.',
    priority: 'medium',
  },

  // ── Vendor/partner-blocked — flagged, not silently dropped ─────────────
  {
    title: 'Community contact upload + SMS/WhatsApp invite + marketing platform',
    description:
      '[BLOCKED — needs an SMS/WhatsApp provider account] Upload contact numbers from the community directory, parse and update for locality, then SMS or WhatsApp all uploaded numbers inviting them to register as elder or family. Also wants a marketing platform for the resulting connects.',
    priority: 'low',
  },
  {
    title: 'WhatsApp chat and video calls in-app',
    description:
      '[BLOCKED — needs a WhatsApp Business API account] Direct WhatsApp-style chat and video calling from within the app, on top of the existing per-neighborhood ChatMessage text chat.',
    priority: 'low',
  },
  {
    title: 'CCTV integration (CP Plus, TP-Link, etc.)',
    description:
      '[BLOCKED — needs a CCTV brand SDK/API partnership] View live camera feeds from the elder\'s home security cameras inside the app.',
    priority: 'low',
  },
  {
    title: 'Emergency security alarm to hooter/WiFi device + police alert with location',
    description:
      '[BLOCKED — needs a security-hardware vendor] A single-tap alarm that triggers a physical hooter/WiFi device and alerts nearby police/security desk with the elder\'s location.',
    priority: 'low',
  },
  {
    title: 'Google sign-in + connected-apps registration',
    description:
      '[BLOCKED — needs a Google Cloud OAuth client + app verification] Register/sign in with Google and surface other Google-connected apps, for frictionless Android onboarding.',
    priority: 'low',
  },
  {
    title: 'Home automation and safety sensors (smart lights/switches, fall sensors, gas/kitchen sensors)',
    description:
      '[BLOCKED — needs device-vendor APIs, e.g. Google Home] Control and monitor WiFi smart lights/switches, fall detection sensors, and gas/kitchen safety sensors from the app.',
    priority: 'low',
  },
  {
    title: 'Banking, GPay/wallet connects, and bill payment',
    description:
      '[BLOCKED — needs a payment-partner decision, e.g. Razorpay] Elder-facing bank/UPI balance view, wallet connects, and bill payment. High-sensitivity financial data — must not be built ad hoc, per the existing Phase F banking/money-transfer caveat.',
    priority: 'low',
  },
  {
    title: 'Financial and legal advice/support',
    description:
      '[BLOCKED — needs licensed-advisor partner sourcing + liability review] In-app access to financial and legal advice for elders and families.',
    priority: 'low',
  },
  {
    title: 'CSR-budget-supported ads (monetization)',
    description:
      '[BLOCKED — needs an ad/sponsorship partner model] CSR-funded advertising as a revenue stream, shown alongside directory/community content.',
    priority: 'low',
  },
  {
    title: 'Counsellor support — conversation-aware wellbeing check',
    description:
      '[BLOCKED — needs a privacy/consent design pass before any build, not just a vendor] AI reads conversations and flags when an elder may need help. Requires deciding what is monitored, opt-in vs. default-on, who sees flags, and data retention before any implementation — this is a design/consent decision, not a vendor integration.',
    priority: 'low',
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
