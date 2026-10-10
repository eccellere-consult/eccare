import { prisma } from '@/lib/db';
import type { DemoPeople } from './accounts';
import { at, DEMO_LAT, DEMO_LNG, newId, type Tally } from './helpers';
import { PROVIDER_OWNER, SUPPORT_PROVIDERS } from './cast';

export interface DemoProviders {
  /** ServiceProvider ids by key: 'pharmacy' plus every supporting provider. */
  id: Record<string, string>;
  /** AdvisoryExpert ids by category. */
  expert: { legal_will: string; senior_insurance: string; reverse_mortgage: string };
  catalog: Record<string, Array<{ id: string; name: string; price: number }>>;
}

interface CatalogSeed { name: string; price: number; category: string; image: string; description: string; inStock?: boolean }

export const PHARMACY_CATALOG: CatalogSeed[] = [
  { name: 'Paracetamol 650 mg (strip of 15)', price: 32, category: 'Medicines', image: 'medicine', description: 'For fever and mild pain. Take only as advised by your doctor.' },
  { name: 'ORS sachets (pack of 10)', price: 85, category: 'Medicines', image: 'medicine', description: 'Oral rehydration salts, orange flavour.' },
  { name: 'Antacid gel 200 ml', price: 118, category: 'Medicines', image: 'medicine', description: 'Quick relief from acidity and gas.' },
  { name: 'Calcium + Vitamin D3 (60 tablets)', price: 245, category: 'Medicines', image: 'medicine', description: 'Bone health supplement for seniors.' },
  { name: 'Multivitamin 50+ (30 tablets)', price: 310, category: 'Medicines', image: 'medicine', description: 'Daily multivitamin formulated for adults over fifty.' },
  { name: 'Herbal cough syrup 100 ml', price: 95, category: 'Medicines', image: 'medicine', description: 'Soothing relief from dry cough.' },
  { name: 'Digital BP monitor (upper arm)', price: 1650, category: 'Health devices', image: 'device', description: 'Large display, memory for 60 readings, irregular heartbeat alert.' },
  { name: 'Glucometer with 25 strips', price: 980, category: 'Health devices', image: 'device', description: 'Simple one-touch blood sugar testing.' },
  { name: 'Pulse oximeter', price: 1150, category: 'Health devices', image: 'device', description: 'Shows oxygen level and pulse in seconds.' },
  { name: 'Digital thermometer', price: 210, category: 'Health devices', image: 'device', description: 'Fast, accurate and easy to read.' },
  { name: 'Adult diapers, medium (pack of 10)', price: 540, category: 'Daily care', image: 'care', description: 'Soft, high absorbency, discreet fit.' },
  { name: 'Waterproof underpads (pack of 10)', price: 320, category: 'Daily care', image: 'care', description: 'Protects the bed and chair.' },
  { name: 'Adjustable walking stick', price: 690, category: 'Daily care', image: 'care', description: 'Lightweight aluminium with a non-slip tip.' },
  { name: 'Anti-slip bathroom mat', price: 449, category: 'Daily care', image: 'care', description: 'Strong suction grip, safe for wet floors.' },
  { name: 'Sugar-free rolled oats 1 kg', price: 275, category: 'Diabetic-friendly food', image: 'food', description: 'High fibre, no added sugar.' },
  { name: 'Diabetic protein powder 400 g', price: 899, category: 'Diabetic-friendly food', image: 'food', description: 'Balanced nutrition shake, vanilla.', inStock: false },
  { name: 'Timolol 0.5% eye drops 5 ml', price: 96, category: 'Medicines', image: 'medicine', description: 'Prescription eye drops for eye pressure. Valid prescription required.' },
  { name: 'Metformin 500 mg (strip of 15)', price: 24, category: 'Medicines', image: 'medicine', description: 'Prescription diabetes tablet. Valid prescription required.' },
  { name: 'Telmisartan 40 mg (strip of 15)', price: 58, category: 'Medicines', image: 'medicine', description: 'Prescription blood pressure tablet. Valid prescription required.' },
  { name: 'Knee support brace', price: 520, category: 'Daily care', image: 'care', description: 'Soft elastic support for stiff or painful knees.' },
  { name: 'Hot water bottle with cover', price: 260, category: 'Wellness', image: 'wellness', description: 'Comforting warmth for aching joints.' },
  { name: 'Pill organiser, weekly (AM/PM)', price: 180, category: 'Daily care', image: 'care', description: 'Fourteen compartments, easy-open lids.' },
];

const NURSING_CATALOG: CatalogSeed[] = [
  { name: 'Home nurse - day shift (12 hours)', price: 1400, category: 'Nursing care', image: 'wellness', description: 'Trained nurse for medicines, vitals, mobility and hygiene.' },
  { name: 'Night attendant (12 hours)', price: 1200, category: 'Nursing care', image: 'wellness', description: 'Overnight presence and help for toileting and emergencies.' },
  { name: 'Injection or dressing visit', price: 350, category: 'Nursing care', image: 'wellness', description: 'Single visit by a qualified nurse.' },
  { name: 'Elder bath and personal care visit', price: 450, category: 'Nursing care', image: 'wellness', description: 'One hour of gentle bathing and grooming help.' },
];

const GROCERY_CATALOG: CatalogSeed[] = [
  { name: 'Seasonal vegetables basket (3 kg)', price: 240, category: 'Vegetables and fruit', image: 'food', description: 'Fresh picks, washed and cut on request.' },
  { name: 'Fruit basket (2 kg)', price: 320, category: 'Vegetables and fruit', image: 'food', description: 'Bananas, apples and seasonal fruit.' },
  { name: 'Toned milk 1 litre (pack of 4)', price: 252, category: 'Daily needs', image: 'home', description: 'Delivered fresh each morning.' },
  { name: 'Whole wheat atta 5 kg', price: 285, category: 'Daily needs', image: 'home', description: 'Stone ground, chakki fresh.' },
  { name: 'Cold-pressed groundnut oil 1 litre', price: 310, category: 'Daily needs', image: 'home', description: 'Heart-friendly cooking oil.' },
  { name: 'Low-salt rock salt 1 kg', price: 60, category: 'Daily needs', image: 'home', description: 'Lower sodium alternative.' },
  { name: 'Idli and dosa batter (1 kg)', price: 85, category: 'Daily needs', image: 'home', description: 'Ready to cook, made fresh each morning.' },
  { name: 'Ragi flour 1 kg', price: 95, category: 'Daily needs', image: 'home', description: 'High in calcium and good for blood sugar.' },
];

const PHYSIO_CATALOG: CatalogSeed[] = [
  { name: 'Home physiotherapy session (45 minutes)', price: 700, category: 'Physiotherapy', image: 'wellness', description: 'Personal session at home with a qualified physiotherapist.' },
  { name: 'Balance and fall-prevention package (6 sessions)', price: 3900, category: 'Physiotherapy', image: 'wellness', description: 'Strength and balance training, with a home safety check.' },
  { name: 'Post-fracture rehabilitation (10 sessions)', price: 6500, category: 'Physiotherapy', image: 'wellness', description: 'Guided recovery plan after a fracture or joint surgery.' },
  { name: 'TENS machine and hot pack, one week', price: 350, category: 'Equipment hire', image: 'device', description: 'Pain relief equipment delivered, explained and collected.' },
];

const COMPANION_CATALOG: CatalogSeed[] = [
  { name: 'Companion visit (2 hours)', price: 400, category: 'Companionship', image: 'care', description: 'Conversation, reading aloud, board games or a walk.' },
  { name: 'Hospital visit companion (half day)', price: 900, category: 'Companionship', image: 'care', description: 'Accompanies your elder to a hospital visit, handles paperwork and updates the family.' },
  { name: 'Evening walk and chat (1 hour)', price: 250, category: 'Companionship', image: 'care', description: 'A friendly companion for the evening walk.' },
  { name: 'Weekly companion plan (4 visits)', price: 1400, category: 'Companionship', image: 'care', description: 'Four two-hour visits through the month at a discount.' },
];

/** The provider businesses: the pharmacy that the provider@eccare.in test login runs, plus
 *  the supporting providers (doctor, auto, legal, insurance, property, nursing, grocery,
 *  physiotherapy, companions) and two whose registration is still pending or was rejected. */
export async function setUpProviders(p: DemoPeople, tally: Tally): Promise<DemoProviders> {
  const id: Record<string, string> = {};
  const verified = (daysAgo: number) => ({ verificationStatus: 'verified' as const, verifiedAt: at(-daysAgo), verifiedById: p.adminId });

  // The test login keeps its row (certificates, history); the demo fills the profile in.
  const pharmacyData = {
    businessName: 'Sanjeevini Pharmacy',
    category: 'pharmacy',
    description: 'Neighbourhood pharmacy and health store at Kowdiar Junction. Medicines, health devices and daily-care products, delivered free within 3 km with senior-friendly packing and monthly refill reminders. Open 8 AM to 10 PM.',
    serviceArea: 'Kowdiar, Pattom, Kuravankonam, Vellayambalam, Vazhuthacaud',
    phone: PROVIDER_OWNER.phone,
    address: 'TC 9/1187, Kowdiar Junction, Thiruvananthapuram 695003',
    backupContactName: 'Sandeep (store manager)',
    backupContactPhone: '9449017382',
    lat: 8.5201,
    lng: 76.9583,
    elderCareCategory: 'local_errands' as const,
    isFeatured: true,
    featuredUntil: at(22),
    featuredPaidAt: at(-8),
    ...verified(97),
  };
  const existing = await prisma.serviceProvider.findUnique({ where: { userId: p.providerUserId } });
  const pharmacy = existing
    ? await prisma.serviceProvider.update({ where: { id: existing.id }, data: { ...pharmacyData, rejectionReason: null, createdAt: at(-99) } })
    : await prisma.serviceProvider.create({ data: { userId: p.providerUserId, ...pharmacyData, createdAt: at(-99), featuredOrderId: `demo_featured_${newId().slice(0, 8)}` } });
  id.pharmacy = pharmacy.id;

  const supportRows = SUPPORT_PROVIDERS.map((s) => {
    const spId = newId();
    id[s.key] = spId;
    const state = s.state ?? 'verified';
    return {
      id: spId,
      userId: p.support[s.key],
      businessName: s.businessName,
      category: s.category,
      description: s.description,
      serviceArea: s.serviceArea,
      phone: s.phone,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      elderCareCategory: s.elderCareCategory ?? null,
      backupContactName: null,
      backupContactPhone: null,
      createdAt: at(-((s.verifiedDaysAgo ?? 2) + 2)),
      ...(state === 'verified'
        ? verified(s.verifiedDaysAgo ?? 30)
        : state === 'pending'
          ? { verificationStatus: 'pending' as const }
          : { verificationStatus: 'rejected' as const, rejectionReason: s.rejectionReason ?? null }),
    };
  });
  await prisma.serviceProvider.createMany({ data: supportRows });
  tally.add('Service providers', supportRows.length + 1);

  // Advisory experts (legal and insurance are provider-linked; reverse mortgage is admin-added).
  const expert = { legal_will: newId(), senior_insurance: newId(), reverse_mortgage: newId() };
  await prisma.advisoryExpert.createMany({
    data: [
      { id: expert.legal_will, category: 'legal_will', name: 'Adv. Narayan Hegde', firmName: 'Hegde & Co Legal', phone: '9448025617', email: 'adv.hegde@demo.eccare.in', bio: 'Twenty years in wills, probate and property transfers. Offers home registration for senior citizens.', consultationFee: 1500, providerId: id.legal, createdAt: at(-90) },
      { id: expert.senior_insurance, category: 'senior_insurance', name: 'Anjali Kapoor', firmName: 'TrustCover Insurance Advisors', phone: '9740186523', email: 'trustcover@demo.eccare.in', bio: 'Independent advisor comparing senior health and critical-illness plans across insurers.', consultationFee: 500, providerId: id.insurance, createdAt: at(-88) },
      { id: expert.reverse_mortgage, category: 'reverse_mortgage', name: 'Suryanarayana Rao', firmName: 'Retired banker, volunteer advisor', phone: '9845172036', email: null, bio: 'Former bank manager who explains reverse mortgage loans honestly, including when they are not a good idea.', consultationFee: 1000, providerId: null, createdAt: at(-86) },
    ],
  });
  tally.add('Advisory experts', 3);

  await prisma.propertyManagementProfile.create({
    data: { providerId: id.property, monthlyFee: 1500, quarterlyFee: 4200, biannualFee: 7800 },
  });

  // Catalogs
  const catalog: DemoProviders['catalog'] = {};
  const make = (key: string, seeds: CatalogSeed[], listedDaysAgo: number) => {
    const rows = seeds.map((s, i) => ({ id: newId(), providerId: id[key], name: s.name, description: s.description, price: s.price, imagePath: `/demo/catalog/${s.image}.svg`, category: s.category, inStock: s.inStock ?? true, createdAt: at(-(listedDaysAgo - i)) }));
    catalog[key] = rows.map((r) => ({ id: r.id, name: r.name, price: r.price }));
    return rows;
  };
  const rows = [
    ...make('pharmacy', PHARMACY_CATALOG, 95),
    ...make('nursing', NURSING_CATALOG, 78),
    ...make('grocery', GROCERY_CATALOG, 75),
    ...make('physio', PHYSIO_CATALOG, 66),
    ...make('companion', COMPANION_CATALOG, 52),
  ];
  await prisma.catalogItem.createMany({ data: rows });
  tally.add('Catalog items (pharmacy, nursing, grocery, physio, companions)', rows.length);

  void DEMO_LAT; void DEMO_LNG;
  return { id, expert, catalog };
}
