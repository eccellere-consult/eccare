import { DEMO_EMAIL_DOMAIN, dob } from './helpers';

/** Everyone in the demo: a cosmopolitan Thiruvananthapuram neighbourhood of independent houses
 *  (Hindu, Christian and Muslim families, Tamil and North Indian neighbours, a few NRI children).
 *  Keys match the avatar drawings in public/demo/people/<key>.svg (scripts/build-demo-portraits.mjs).
 *  All names and numbers are invented. */

export const avatarOf = (key: string) => `/demo/people/${key}.svg`;

export interface PersonSpec {
  key: string;
  name: string;
  phone: string;
  /** House number in the association's format (KGRA-27) or a house name (Sreevalsam). */
  house: string;
  born: Date;
  /** Days ago they joined the community. */
  joined: number;
  communityRole?: 'member' | 'committee' | 'admin';
  volunteer?: { availability: 'weekdays' | 'weekends' | 'always'; types: string[]; status?: 'verified' | 'pending' };
  hobbies?: string[];
}

export const ELDER = { key: 'elder', house: 'KGRA-27', phone: '9847362051', born: dob(1955, 2, 9) };
export const FAMILY = { key: 'family', house: 'KGRA-29', phone: '9446518203', born: dob(1982, 8, 21) };
/** The daughter, working in Dubai — a family member with an international number. */
export const SISTER = { key: 'divya', name: 'Divya Nair', email: `divya.nair@${DEMO_EMAIL_DOMAIN}`, phone: '+971508742316', born: dob(1986, 4, 15) };
export const PROVIDER_OWNER = { key: 'pharmacy', phone: '9446021785', born: dob(1978, 11, 6) };

/** The neighbours in the demo community (besides the elder and the family member). */
export const NEIGHBOURS: PersonSpec[] = [
  { key: 'raghavan', name: 'Raghavan Pillai', phone: '9447205613', house: 'KGRA-3', born: dob(1957, 6, 18), joined: 100, communityRole: 'committee' },
  { key: 'mini', name: 'Mini Varghese', phone: '9895173204', house: 'KGRA-12', born: dob(1972, 3, 3), joined: 100, communityRole: 'committee' },
  { key: 'haridas', name: 'Haridas Menon', phone: '9446289157', house: 'Sreevalsam', born: dob(1963, 12, 1), joined: 99, communityRole: 'committee' },
  { key: 'sheela', name: 'Sheela Iyer', phone: '9744361829', house: 'KGRA-18', born: dob(1969, 9, 27), joined: 96, communityRole: 'committee', hobbies: ['pookalam', 'bhajan'] },
  { key: 'girija', name: 'Girija Warrier', phone: '9847106532', house: 'KGRA-5', born: dob(1956, 7, 14), joined: 92, hobbies: ['bhajan', 'books'] },
  { key: 'abhijith', name: 'Abhijith Krishnan', phone: '9809472163', house: 'KGRA-31', born: dob(1991, 1, 22), joined: 88, volunteer: { availability: 'always', types: ['medical_runs', 'errands'] } },
  { key: 'fathima', name: 'Fathima Beevi', phone: '9496028374', house: 'KGRA-9', born: dob(1960, 10, 5), joined: 85, hobbies: ['books', 'bhajan'] },
  { key: 'george', name: 'George Kurien', phone: '9447690318', house: 'Kripa', born: dob(1950, 4, 30), joined: 84, hobbies: ['chess', 'walkers'] },
  { key: 'venkatesh', name: 'Venkatesh Subramanian', phone: '9895740126', house: 'KGRA-22', born: dob(1966, 11, 9), joined: 80, hobbies: ['chess'] },
  { key: 'annamma', name: 'Annamma Mathew', phone: '9446731052', house: 'KGRA-15', born: dob(1953, 8, 16), joined: 77, hobbies: ['bhajan'] },
  { key: 'rahul', name: 'Rahul Chandran', phone: '9961384702', house: 'KGRA-34', born: dob(1990, 2, 25), joined: 70, volunteer: { availability: 'weekends', types: ['tech_support', 'errands'] } },
  { key: 'basheer', name: 'Basheer Ahmed', phone: '9847295016', house: 'KGRA-7', born: dob(1961, 6, 8), joined: 64, hobbies: ['walkers'] },
  { key: 'anjana', name: 'Anjana Gopinath', phone: '9495618237', house: 'Ananda Nilayam', born: dob(1980, 5, 19), joined: 58, volunteer: { availability: 'weekdays', types: ['companionship', 'medical_runs'] }, hobbies: ['pookalam'] },
  { key: 'francis', name: 'Francis Fernandez', phone: '9446157382', house: 'KGRA-24', born: dob(1946, 9, 2), joined: 50, hobbies: ['walkers', 'chess'] },
  { key: 'kamini', name: 'Kamini Shah', phone: '9847823690', house: 'KGRA-11', born: dob(1952, 3, 19), joined: 44, hobbies: ['books'] },
  { key: 'biju', name: 'Biju Thomas', phone: '9447035821', house: 'KGRA-36', born: dob(1975, 12, 12), joined: 33, volunteer: { availability: 'weekdays', types: ['companionship'], status: 'pending' } },
];
/** Someone who has asked to join and is waiting for the committee. */
export const PENDING_JOINER = { key: 'shahul', name: 'Shahul Hameed', phone: '9497316028', house: 'KGRA-40', born: dob(1988, 7, 3) };

export type ProviderState = 'verified' | 'pending' | 'rejected';
export interface ProviderSpec {
  key: string;
  email: string;
  name: string;
  businessName: string;
  category: string;
  phone: string;
  description: string;
  serviceArea: string;
  address: string;
  lat: number;
  lng: number;
  elderCareCategory?: 'home_treatment' | 'home_nursing' | 'companion_service' | 'local_errands';
  born: Date;
  state?: ProviderState;
  rejectionReason?: string;
  /** Days ago their registration was verified. */
  verifiedDaysAgo?: number;
}

const e = (k: string) => `${k}@${DEMO_EMAIL_DOMAIN}`;

/** Supporting providers: each stands for a different provider portal, so every service the
 *  elder and family use has someone real-looking on the other end. */
export const SUPPORT_PROVIDERS: ProviderSpec[] = [
  { key: 'doctor', email: e('dr.latha'), name: 'Dr. Latha Varma', businessName: 'Varma Family Clinic', category: 'doctor', phone: '9847103265', description: 'General medicine and geriatric care. Home visits for seniors by appointment.', serviceArea: 'Kowdiar, Pattom, Kuravankonam, Vellayambalam', address: 'TC 9/1204, Kowdiar Junction, Thiruvananthapuram 695003', lat: 8.5208, lng: 76.9576, born: dob(1979, 3, 12), verifiedDaysAgo: 96 },
  { key: 'auto', email: e('sajeev.cabs'), name: 'Sajeev Kumar', businessName: 'Sajeev Autos & Cabs', category: 'auto_transport', phone: '9446270918', description: 'Reliable autos and cabs for hospital visits, temple trips and airport runs. Patient with elders.', serviceArea: 'Kowdiar, Pattom, Vazhuthacaud, Medical College', address: 'Auto stand, Kowdiar Junction', lat: 8.5199, lng: 76.9571, born: dob(1984, 8, 4), verifiedDaysAgo: 94 },
  { key: 'legal', email: e('adv.ramesh'), name: 'Adv. Ramesh Chandran', businessName: 'Chandran & Associates', category: 'legal_help', phone: '9446385017', description: 'Wills, powers of attorney, property transfers and NRI property matters. Home registration for senior citizens.', serviceArea: 'Thiruvananthapuram', address: 'Second Floor, Statue Junction, Thiruvananthapuram 695001', lat: 8.5025, lng: 76.9496, born: dob(1972, 2, 2), verifiedDaysAgo: 90 },
  { key: 'insurance', email: e('trustcover'), name: 'Nisha Ravindran', businessName: 'TrustCover Insurance Advisors', category: 'insurance', phone: '9895624173', description: 'Independent advisors for senior health and critical-illness cover, including plans for parents of NRIs.', serviceArea: 'Thiruvananthapuram', address: 'Vellayambalam Junction, Thiruvananthapuram 695010', lat: 8.5107, lng: 76.9621, born: dob(1985, 5, 16), verifiedDaysAgo: 88 },
  { key: 'property', email: e('safenest'), name: 'Manoj Pillai', businessName: 'SafeNest Property Care', category: 'property_management', phone: '9961250837', description: 'Periodic inspection and upkeep of homes of NRI owners and seniors, with repair coordination and monthly photo reports.', serviceArea: 'Thiruvananthapuram city', address: 'Sasthamangalam, Thiruvananthapuram 695010', lat: 8.5099, lng: 76.9718, born: dob(1981, 9, 23), verifiedDaysAgo: 85 },
  { key: 'nursing', email: e('karuna.nursing'), name: 'Sr. Mary Joseph', businessName: 'Karuna Home Nursing', category: 'nursing', phone: '9496253718', description: 'Trained nurses and attendants for home care, post-surgery support and night stays.', serviceArea: 'Kowdiar, Pattom, Vazhuthacaud, Nanthancode', address: 'Nanthancode, Thiruvananthapuram 695003', lat: 8.5171, lng: 76.9541, elderCareCategory: 'home_nursing', born: dob(1976, 12, 1), verifiedDaysAgo: 82 },
  { key: 'grocery', email: e('pattom.mart'), name: 'Hamza Koya', businessName: 'Pattom Fresh Mart', category: 'grocery', phone: '9744306152', description: 'Daily groceries, fruit and vegetables delivered to your door, with senior-friendly packing.', serviceArea: 'Kowdiar, Pattom, Kuravankonam', address: 'Pattom Junction, Thiruvananthapuram 695004', lat: 8.5240, lng: 76.9457, born: dob(1983, 4, 7), verifiedDaysAgo: 79 },
  { key: 'physio', email: e('movewell'), name: 'Dr. Neethu Raj', businessName: 'MoveWell Physio at Home', category: 'physiotherapy', phone: '9847561390', description: 'Physiotherapy at home for balance, joint pain and recovery after fractures or surgery.', serviceArea: 'Kowdiar, Pattom, Vazhuthacaud', address: 'Kuravankonam, Thiruvananthapuram 695003', lat: 8.5233, lng: 76.9536, elderCareCategory: 'home_treatment', born: dob(1988, 7, 29), verifiedDaysAgo: 70 },
  { key: 'companion', email: e('thanal'), name: 'Lissy Thomas', businessName: 'Thanal Companions', category: 'other', phone: '9744198362', description: 'Friendly, vetted companions for walks, reading aloud, temple and church visits, hospital visits and a chat over tea.', serviceArea: 'Kowdiar, Pattom, Vazhuthacaud', address: 'Vazhuthacaud, Thiruvananthapuram 695014', lat: 8.4976, lng: 76.9588, elderCareCategory: 'companion_service', born: dob(1974, 10, 14), verifiedDaysAgo: 55 },
  { key: 'ayurveda', email: e('vaidyashala'), name: 'Dr. Unnikrishnan Namboothiri', businessName: 'Vaidyashala Ayurveda Home Care', category: 'other', phone: '9447102853', description: 'Ayurvedic consultation and Panchakarma therapy at home, by a vaidya from a traditional family.', serviceArea: 'Thiruvananthapuram city', address: 'Poojappura, Thiruvananthapuram 695012', lat: 8.4747, lng: 76.9783, born: dob(1977, 1, 11), state: 'pending' },
  { key: 'quickcure', email: e('quickcure'), name: 'Imtiaz Baig', businessName: 'QuickCure Online Pharmacy', category: 'pharmacy', phone: '9035872614', description: 'Discount medicines delivered from our warehouse.', serviceArea: 'Kerala', address: 'Industrial Area, Kochi', lat: 9.9312, lng: 76.2673, born: dob(1990, 3, 3), state: 'rejected', rejectionReason: 'Could not verify a valid drug licence. Please re-apply with a copy of the licence.' },
];

/** Doctors who are in the community directory without having a login of their own. */
export const LEGACY_DOCTORS = [
  { key: 'drjoseph', name: 'Dr. Joseph Alexander', clinicName: 'Alexander Bone & Joint Clinic', specialty: 'Orthopaedics', phone: '9847236150', fee: 800, locality: 'Pattom', lat: 8.5246, lng: 76.9446, qualifications: 'MBBS, MS (Orthopaedics)', background: 'Specialises in knee and hip problems in the elderly, including non-surgical management.' },
  { key: 'drshamina', name: 'Dr. Shamina Rahman', clinicName: 'Kowdiar Eye & Diabetes Centre', specialty: 'Ophthalmology', phone: '9746915382', fee: 700, locality: 'Kowdiar', lat: 8.5189, lng: 76.9599, qualifications: 'MBBS, MS (Ophthalmology)', background: 'Cataract and glaucoma care, with a weekly senior-citizen screening clinic.' },
];
