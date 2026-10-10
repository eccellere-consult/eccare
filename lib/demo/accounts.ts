import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import {
  addressOf, at, DEMO_CITY, DEMO_EMAIL_DOMAIN, DEMO_LAT, DEMO_LNG, DEMO_PASSWORD, DEMO_PINCODE, DEMO_STATE, MAIN_ACCOUNTS, newId, type Tally,
} from './helpers';
import { avatarOf, ELDER, FAMILY, NEIGHBOURS, PENDING_JOINER, PROVIDER_OWNER, SISTER, SUPPORT_PROVIDERS } from './cast';

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
  sisterId: string;
  pendingJoinerId: string;
  neighbour: Record<string, string>;
  support: Record<string, string>;
  accounts: AccountReport[];
}

/** An existing account keeps its password; a missing one is created with a known demo password.
 *  Name, phone, photo and profile are replaced with the demo identity. */
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

  const data: Record<string, unknown> = { ...fields, name: defaults.name };
  if (data.phone) {
    const clash = await prisma.user.findUnique({ where: { phone: data.phone as string }, select: { id: true } });
    if (clash && clash.id !== existing?.id) delete data.phone;
  }

  if (!existing) {
    const created = await prisma.user.create({
      data: { email, role, passwordHash: await hashPassword(defaults.password), ...(data as object), name: defaults.name } as never,
      select: { id: true },
    });
    report.push({ email, role, name: defaults.name, password: `${defaults.password} (account was missing, so it was created)` });
    return created.id;
  }

  await prisma.user.update({ where: { id: existing.id }, data: data as never });
  report.push({ email, role, name: defaults.name, password: 'unchanged (your existing password)' });
  return existing.id;
}

export async function setUpPeople(adminId: string, tally: Tally): Promise<DemoPeople> {
  const accounts: AccountReport[] = [];
  const common = { city: DEMO_CITY, state: DEMO_STATE, pincode: DEMO_PINCODE };

  const elderId = await ensureMain(
    MAIN_ACCOUNTS.elder.email, 'elder', MAIN_ACCOUNTS.elder,
    {
      phone: ELDER.phone, dateOfBirth: ELDER.born, avatarUrl: avatarOf(ELDER.key), createdAt: at(-101),
      language: 'en', secondaryLanguage: 'ml', fontSizePref: 'xlarge', highContrast: true, voiceEnabled: true,
      bloodGroup: 'B+', address: addressOf(ELDER.house), ...common, lat: DEMO_LAT, lng: DEMO_LNG,
      familyDoctorName: 'Dr. Latha Varma', familyDoctorPhone: SUPPORT_PROVIDERS[0].phone,
      familyDoctorVideoLink: 'https://meet.google.com/demo-varma-clinic',
      preferredHospitalName: 'Anantha Multispeciality Hospital, Pattom',
      preferredHospitalLocation: 'https://maps.google.com/?q=8.5240,76.9457',
    },
    accounts,
  );

  const familyId = await ensureMain(
    MAIN_ACCOUNTS.family.email, 'caregiver', MAIN_ACCOUNTS.family,
    {
      phone: FAMILY.phone, dateOfBirth: FAMILY.born, avatarUrl: avatarOf(FAMILY.key), createdAt: at(-101),
      language: 'en', address: addressOf(FAMILY.house), ...common, lat: DEMO_LAT, lng: DEMO_LNG,
    },
    accounts,
  );

  const providerUserId = await ensureMain(
    MAIN_ACCOUNTS.provider.email, 'provider', MAIN_ACCOUNTS.provider,
    {
      phone: PROVIDER_OWNER.phone, dateOfBirth: PROVIDER_OWNER.born, avatarUrl: avatarOf(PROVIDER_OWNER.key), createdAt: at(-97),
      address: 'TC 9/1187, Kowdiar Junction, Thiruvananthapuram 695003', ...common,
    },
    accounts,
  );

  const demoHash = await hashPassword(DEMO_PASSWORD);
  // Neighbours cannot be signed in to (and cannot be "claimed" by a later registration).
  const unusableHash = await hashPassword(randomBytes(24).toString('hex'));

  const sisterId = newId();
  const pendingJoinerId = newId();
  const neighbour: Record<string, string> = {};
  const support: Record<string, string> = {};

  const age = (born: Date) => new Date().getUTCFullYear() - born.getUTCFullYear();
  const rows = [
    {
      id: sisterId, name: SISTER.name, email: SISTER.email, phone: SISTER.phone, role: 'caregiver' as const,
      passwordHash: unusableHash, dateOfBirth: SISTER.born, city: 'Dubai', language: 'en', avatarUrl: avatarOf(SISTER.key), createdAt: at(-95),
    },
    {
      id: pendingJoinerId, name: PENDING_JOINER.name, email: `${PENDING_JOINER.key}@${DEMO_EMAIL_DOMAIN}`, phone: PENDING_JOINER.phone,
      role: 'caregiver' as const, passwordHash: unusableHash, dateOfBirth: PENDING_JOINER.born, city: DEMO_CITY, language: 'en',
      avatarUrl: avatarOf(PENDING_JOINER.key), createdAt: at(-1),
    },
    ...NEIGHBOURS.map((p) => {
      const id = newId();
      neighbour[p.key] = id;
      return {
        id, name: p.name, email: `${p.key}@${DEMO_EMAIL_DOMAIN}`, phone: p.phone,
        role: (age(p.born) >= 60 ? 'elder' : 'caregiver') as 'elder' | 'caregiver',
        passwordHash: unusableHash, dateOfBirth: p.born, address: addressOf(p.house), ...common, language: 'en',
        avatarUrl: avatarOf(p.key), createdAt: at(-p.joined),
      };
    }),
    ...SUPPORT_PROVIDERS.map((p) => {
      const id = newId();
      support[p.key] = id;
      if (p.state !== 'rejected') accounts.push({ email: p.email, role: 'provider', name: p.businessName, password: DEMO_PASSWORD });
      return {
        id, name: p.name, email: p.email, phone: p.phone, role: 'provider' as const,
        passwordHash: demoHash, dateOfBirth: p.born, address: p.address, ...common, language: 'en',
        avatarUrl: avatarOf(p.key), createdAt: at(-((p.verifiedDaysAgo ?? 3) + 2)),
      };
    }),
  ];
  await prisma.user.createMany({ data: rows });
  tally.add('People (neighbours, providers, family abroad)', rows.length);

  return { adminId, elderId, familyId, providerUserId, sisterId, pendingJoinerId, neighbour, support, accounts };
}
