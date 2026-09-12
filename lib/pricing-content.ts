import { prisma } from '@/lib/db';

const SINGLETON_ID = 'singleton';

export interface PricingContent {
  isVisible: boolean;
  elderIntro: string;
  elderFeatures: string[];
  familyIntro: string;
  familyFeatures: string[];
  communityIntro: string;
  communityFeatures: string[];
  elderPrice: number;
  familyMonthlyPrice: number;
  familyAnnualPrice: number;
  communityPrice: number;
  trialDays: number;
}

// Seeded once, on first read, from what's actually shipped in the app today — not the full
// EC_Care_Pricing_Plan.docx wishlist. Anything in that document without a working feature
// behind it (AI wellness check-ins, predictive risk alerts, tiered SOS SLAs, a Dedicated Care
// Manager, subscriber discounts, an RWA annual fee, etc.) is deliberately left out rather than
// shown as "coming soon" — admin can add it for real once it's built, via /admin/pricing.
const DEFAULTS = {
  isVisible: true,
  elderIntro:
    "Every elder's core experience — safety, health tracking, marketplace access, and community — free, always, with no upgrade prompts.",
  elderFeatures: [
    'Emergency SOS with your location shared to linked family and emergency contacts',
    'Ambulance and Police quick-dial',
    'Family Call — one-tap calling for saved contacts, plus a large accessible dial pad',
    'Emergency contacts management',
    'Medicine reminders with adherence tracking',
    'Appointments, Health Notes, and Health Essentials (family doctor, blood group, insurance docs)',
    'Prescription photo reading, AI-assisted',
    'Full marketplace access — order from any verified provider or vendor',
    'Bill Pay, Senior-Friendly Rentals, Advisory (legal/insurance) consultations, Auto & Taxi and other local services',
    'Community: neighbour directory with favourites, announcements, events, hobbies & interest groups, chat, helplines, local vendors, community queries, shared documents, panic alert',
    '"Speak to Arya" voice assistant — call a contact, trigger SOS, check medicines or appointments, by voice or typed text',
    'Newsletter archive',
  ],
  familyIntro:
    "₹199/month or ₹2,000/year, with a free trial to start — the elder's own account is always free, this covers the family member's own access.",
  familyFeatures: [
    "Family Dashboard — activity, bookings, and SOS log for each linked elder",
    "Health access to view and manage medicines, appointments, and health notes, permissioned per elder",
    'Invite and link one or more elders',
    "Order or book on an elder's behalf across the whole marketplace",
    "Everything in the elder's community suite, from the family side",
    'Mobile: a glance screen with SOS status, medicine adherence, and one-tap calling',
  ],
  communityIntro:
    'Every joined neighbourhood already gets a full community suite, included today.',
  communityFeatures: [
    'Announcements and an events calendar',
    'Neighbour directory with favourites',
    'Hobbies & interest groups, and neighbour chat',
    'Helplines and a local vendor marketplace',
    'Committee queries and shared documents',
    'Panic and emergency alerts',
    'Committee/admin tools: member management and fee/dues collection with Razorpay payment',
  ],
  elderPrice: 0,
  familyMonthlyPrice: 199,
  familyAnnualPrice: 2000,
  communityPrice: 0,
  trialDays: 14,
} as const satisfies PricingContent;

function toContent(row: {
  isVisible: boolean;
  elderIntro: string;
  elderFeatures: unknown;
  familyIntro: string;
  familyFeatures: unknown;
  communityIntro: string;
  communityFeatures: unknown;
  elderPrice: { toNumber?: () => number } | number;
  familyMonthlyPrice: { toNumber?: () => number } | number;
  familyAnnualPrice: { toNumber?: () => number } | number;
  communityPrice: { toNumber?: () => number } | number;
  trialDays: number;
}): PricingContent {
  const num = (v: { toNumber?: () => number } | number) => (typeof v === 'number' ? v : Number(v));
  return {
    isVisible: row.isVisible,
    elderIntro: row.elderIntro,
    elderFeatures: row.elderFeatures as string[],
    familyIntro: row.familyIntro,
    familyFeatures: row.familyFeatures as string[],
    communityIntro: row.communityIntro,
    communityFeatures: row.communityFeatures as string[],
    elderPrice: num(row.elderPrice),
    familyMonthlyPrice: num(row.familyMonthlyPrice),
    familyAnnualPrice: num(row.familyAnnualPrice),
    communityPrice: num(row.communityPrice),
    trialDays: row.trialDays,
  };
}

/** Creates the singleton row with real, shipped-feature defaults on first read if it doesn't
 *  exist yet, so callers (and a fresh environment) never see empty content. */
export async function getPricingContent(): Promise<PricingContent> {
  const row = await prisma.pricingPageContent.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID, ...DEFAULTS },
  });
  return toContent(row);
}

export async function setPricingContent(
  data: Partial<PricingContent>,
  updatedById: string,
): Promise<PricingContent> {
  const row = await prisma.pricingPageContent.upsert({
    where: { id: SINGLETON_ID },
    update: { ...data, updatedById },
    create: { id: SINGLETON_ID, ...DEFAULTS, ...data, updatedById },
  });
  return toContent(row);
}
