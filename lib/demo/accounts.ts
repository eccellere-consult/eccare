import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  MAIN_ACCOUNTS,
  NEIGHBOURS,
  SUPPORT_PROVIDERS,
  dob,
  newId,
  type Tally,
} from './helpers';

export interface AccountReport {
  email: string;
  role: string;
  name: string;
  /** What to tell the presenter about the password. */
  password: string;
}

export interface DemoPeople {
  adminId: string;
  elderId: string;
  familyId: string;
  providerUserId: string;
  priyaId: string;
  neighbour: Record<string, string>;
  support: Record<string, string>;
  accounts: AccountReport[];
}

/** An existing account keeps its password; a missing one is created with a known demo password. */
async function ensureMain(
  email: string,
  role: 'elder' | 'caregiver' | 'provider',
  defaults: { password: string; name: string },
  fields: Record<string, unknown>,
  report: AccountReport[],
): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== role) {
    throw new Error(`${email} exists as a ${existing.role} account, but the demo needs it to be ${role}. Fix or rename that account first.`);
  }

  if (!existing) {
    const created = await prisma.user.create({
      data: { email, role, name: defaults.name, passwordHash: await hashPassword(defaults.password), ...fields },
      select: { id: true },
    });
    report.push({ email, role, name: defaults.name, password: `${defaults.password} (account was missing, so it was created)` });
    return created.id;
  }

  // Never touch the password; fill phone / date of birth only when they are empty.
  const patch: Record<string, unknown> = { ...fields, name: defaults.name };
  if (existing.phone) delete patch.phone;
  if (existing.dateOfBirth) delete patch.dateOfBirth;
  if (patch.phone) {
    const clash = await prisma.user.findUnique({ where: { phone: patch.phone as string }, select: { id: true } });
    if (clash) delete patch.phone;
  }
  await prisma.user.update({ where: { id: existing.id }, data: patch });
  report.push({ email, role, name: defaults.name, password: 'unchanged (your existing password)' });
  return existing.id;
}

export async function setUpPeople(adminId: string, tally: Tally): Promise<DemoPeople> {
  const accounts: AccountReport[] = [];

  const elderId = await ensureMain(
    MAIN_ACCOUNTS.elder.email, 'elder', MAIN_ACCOUNTS.elder,
    {
      phone: '9000000001',
      dateOfBirth: dob(1954, 3, 14),
      language: 'en',
      secondaryLanguage: 'kn',
      fontSizePref: 'xlarge',
      highContrast: true,
      voiceEnabled: true,
      bloodGroup: 'B+',
      address: 'A-204, Sunrise Residency, 12th Cross, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      lat: 12.9784,
      lng: 77.6408,
      familyDoctorName: 'Dr. Ramesh Bhat',
      familyDoctorPhone: '9000000301',
      familyDoctorVideoLink: 'https://meet.google.com/demo-bhat-clinic',
      preferredHospitalName: 'Manipal Hospital, Old Airport Road',
      preferredHospitalLocation: 'https://maps.google.com/?q=Manipal+Hospital+Old+Airport+Road+Bengaluru',
    },
    accounts,
  );

  const familyId = await ensureMain(
    MAIN_ACCOUNTS.family.email, 'caregiver', MAIN_ACCOUNTS.family,
    {
      phone: '9000000002',
      dateOfBirth: dob(1982, 7, 9),
      language: 'en',
      address: 'B-110, Sunrise Residency, 12th Cross, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
    },
    accounts,
  );

  const providerUserId = await ensureMain(
    MAIN_ACCOUNTS.provider.email, 'provider', MAIN_ACCOUNTS.provider,
    { phone: '9000000003', dateOfBirth: dob(1980, 1, 20), city: 'Bengaluru', state: 'Karnataka', pincode: '560038' },
    accounts,
  );

  // A caregiver abroad, to show a family with more than one person and an international number.
  const demoHash = await hashPassword(DEMO_PASSWORD);
  // Neighbours cannot be signed in to (and cannot be "claimed" by a later registration).
  const unusableHash = await hashPassword(randomBytes(24).toString('hex'));

  const priyaId = newId();
  const neighbour: Record<string, string> = {};
  const support: Record<string, string> = {};

  const rows = [
    {
      id: priyaId, name: 'Priya Narayanan', email: `priya@${DEMO_EMAIL_DOMAIN}`, phone: '+6591230000', role: 'caregiver' as const,
      passwordHash: unusableHash, dateOfBirth: dob(1985, 11, 2), city: 'Singapore', language: 'en',
    },
    ...NEIGHBOURS.map((p) => {
      const id = newId();
      neighbour[p.key] = id;
      const age = new Date().getUTCFullYear() - p.born.getUTCFullYear();
      return {
        id, name: p.name, email: `${p.key}@${DEMO_EMAIL_DOMAIN}`, phone: p.phone,
        role: (age >= 60 ? 'elder' : 'caregiver') as 'elder' | 'caregiver',
        passwordHash: unusableHash, dateOfBirth: p.born, address: `${p.flat}, Sunrise Residency, Indiranagar`,
        city: 'Bengaluru', state: 'Karnataka', pincode: '560038', language: 'en',
      };
    }),
    ...SUPPORT_PROVIDERS.map((p) => {
      const id = newId();
      support[p.key] = id;
      accounts.push({ email: p.email, role: 'provider', name: p.businessName, password: DEMO_PASSWORD });
      return {
        id, name: p.name, email: p.email, phone: p.phone, role: 'provider' as const,
        passwordHash: demoHash, dateOfBirth: p.born, address: p.address, city: 'Bengaluru', state: 'Karnataka',
        pincode: '560038', language: 'en',
      };
    }),
  ];
  await prisma.user.createMany({ data: rows });
  tally.add('People (neighbours, supporting providers, family abroad)', rows.length);

  return { adminId, elderId, familyId, providerUserId, priyaId, neighbour, support, accounts };
}
