import { prisma } from '@/lib/db';
import type { DemoPeople } from './accounts';
import { at, newId, SUPPORT_PROVIDERS, type Tally } from './helpers';

export interface DemoProviders {
  /** ServiceProvider ids by key: 'pharmacy' plus every supporting provider. */
  id: Record<string, string>;
  /** AdvisoryExpert ids by category. */
  expert: { legal_will: string; senior_insurance: string; reverse_mortgage: string };
  catalog: Record<string, Array<{ id: string; name: string; price: number }>>;
}

interface CatalogSeed { name: string; price: number; category: string; image: string; description: string; inStock?: boolean }

const PHARMACY_CATALOG: CatalogSeed[] = [
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
];

/** The 8 provider businesses: the pharmacy that the provider@eccare.in test login runs, plus
 *  seven supporting providers (doctor, auto, legal, insurance, property, nursing, grocery). */
export async function setUpProviders(p: DemoPeople, tally: Tally): Promise<DemoProviders> {
  const id: Record<string, string> = {};
  const verifiedBase = { verificationStatus: 'verified' as const, verifiedAt: at(-120), verifiedById: p.adminId };

  // The test login keeps its row (certificates, history); the demo fills the profile in.
  const pharmacyData = {
    businessName: 'City Care Pharmacy',
    category: 'pharmacy',
    description: 'Neighbourhood pharmacy and health store in Indiranagar. Medicines, health devices and daily-care products delivered free within 3 km, with senior-friendly packing and monthly refill reminders.',
    serviceArea: 'Indiranagar, Domlur, HAL, CV Raman Nagar',
    phone: '9000000003',
    address: '21, 100 Feet Road, Indiranagar, Bengaluru 560038',
    backupContactName: 'Sandeep (store manager)',
    backupContactPhone: '9000000004',
    lat: 12.9731,
    lng: 77.6405,
    elderCareCategory: 'local_errands' as const,
    isFeatured: true,
    featuredUntil: at(22),
    featuredPaidAt: at(-8),
    ...verifiedBase,
  };
  const existing = await prisma.serviceProvider.findUnique({ where: { userId: p.providerUserId } });
  const pharmacy = existing
    ? await prisma.serviceProvider.update({ where: { id: existing.id }, data: { ...pharmacyData, rejectionReason: null } })
    : await prisma.serviceProvider.create({ data: { userId: p.providerUserId, ...pharmacyData, featuredOrderId: `demo_featured_${newId().slice(0, 8)}` } });
  id.pharmacy = pharmacy.id;

  const supportRows = SUPPORT_PROVIDERS.map((s) => {
    const spId = newId();
    id[s.key] = spId;
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
      ...verifiedBase,
    };
  });
  await prisma.serviceProvider.createMany({ data: supportRows });
  tally.add('Service providers', supportRows.length + 1);

  // Advisory experts (legal and insurance are provider-linked; reverse mortgage is admin-added).
  const expert = { legal_will: newId(), senior_insurance: newId(), reverse_mortgage: newId() };
  await prisma.advisoryExpert.createMany({
    data: [
      { id: expert.legal_will, category: 'legal_will', name: 'Adv. Suresh Menon', firmName: 'Menon & Associates', phone: '9000000203', email: 'adv.menon@demo.eccare.in', bio: 'Twenty years in wills, probate and property transfers. Offers home registration for senior citizens.', consultationFee: 1500, providerId: id.legal },
      { id: expert.senior_insurance, category: 'senior_insurance', name: 'Pooja Bhandari', firmName: 'SecureLife Insurance Advisors', phone: '9000000204', email: 'securelife@demo.eccare.in', bio: 'Independent advisor comparing senior health and critical-illness plans across insurers.', consultationFee: 500, providerId: id.insurance },
      { id: expert.reverse_mortgage, category: 'reverse_mortgage', name: 'Prakash Deshpande', firmName: 'Retired banker, volunteer advisor', phone: '9000000715', email: null, bio: 'Former bank manager who explains reverse mortgage loans honestly, including when they are not a good idea.', consultationFee: 1000, providerId: null },
    ],
  });
  tally.add('Advisory experts', 3);

  await prisma.propertyManagementProfile.create({
    data: { providerId: id.property, monthlyFee: 1500, quarterlyFee: 4200, biannualFee: 7800 },
  });

  // Catalogs
  const catalog: DemoProviders['catalog'] = {};
  const make = (key: string, seeds: CatalogSeed[]) => {
    const rows = seeds.map((s) => ({ id: newId(), providerId: id[key], name: s.name, description: s.description, price: s.price, imagePath: `/demo/catalog/${s.image}.svg`, category: s.category, inStock: s.inStock ?? true }));
    catalog[key] = rows.map((r) => ({ id: r.id, name: r.name, price: r.price }));
    return rows;
  };
  const rows = [...make('pharmacy', PHARMACY_CATALOG), ...make('nursing', NURSING_CATALOG), ...make('grocery', GROCERY_CATALOG)];
  await prisma.catalogItem.createMany({ data: rows });
  tally.add('Catalog items (pharmacy, nursing, grocery)', rows.length);

  return { id, expert, catalog };
}
