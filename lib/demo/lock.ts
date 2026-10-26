import { prisma } from '@/lib/db';
import { DEMO_COMMUNITY_CODE, DEMO_EMAIL_DOMAIN, MAIN_ACCOUNTS } from './helpers';

/**
 * The demo data is read-only for the demo logins (the three test accounts and the supporting
 * providers) unless an admin unlocks it. "Locked" means every request that would change data
 * is refused for those accounts — enforced in the middleware (see lib/demo/guard.ts), so no
 * individual route needs to know about it. Admins are never affected.
 *
 * An unlock has an end time, so nobody has to remember to lock it again.
 */

export interface DemoProtection {
  /** The demo has been loaded; before that the test accounts are ordinary accounts. */
  loaded: boolean;
  locked: boolean;
  unlockedUntil: Date | null;
  /** Ids of the accounts the lock applies to. */
  userIds: Set<string>;
}

// The middleware asks on every write from a logged-in user, so keep the answer for a few
// seconds. An unlock or lock by an admin therefore takes effect within this time.
const TTL_MS = 5_000;
let cached: { at: number; value: DemoProtection } | null = null;

export function invalidateDemoProtection() {
  cached = null;
}

export async function getDemoProtection(): Promise<DemoProtection> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const [hood, settings, users] = await Promise.all([
    prisma.neighborhood.findUnique({ where: { joinCode: DEMO_COMMUNITY_CODE }, select: { id: true } }),
    prisma.platformSettings.findUnique({ where: { id: 'singleton' }, select: { demoUnlockedUntil: true } }),
    prisma.user.findMany({
      where: {
        OR: [
          { email: { in: [MAIN_ACCOUNTS.elder.email, MAIN_ACCOUNTS.family.email, MAIN_ACCOUNTS.provider.email] } },
          { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
        ],
      },
      select: { id: true },
    }),
  ]);

  const unlockedUntil = settings?.demoUnlockedUntil ?? null;
  const loaded = Boolean(hood);
  const value: DemoProtection = {
    loaded,
    unlockedUntil,
    locked: loaded && !(unlockedUntil && unlockedUntil.getTime() > Date.now()),
    userIds: loaded ? new Set(users.map((u) => u.id)) : new Set(),
  };
  cached = { at: Date.now(), value };
  return value;
}

/** Unlocks editing for `minutes`, or locks it again straight away when `minutes` is null. */
export async function setDemoUnlock(minutes: number | null): Promise<void> {
  const demoUnlockedUntil = minutes ? new Date(Date.now() + minutes * 60_000) : null;
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: { demoUnlockedUntil },
    create: { id: 'singleton', demoUnlockedUntil },
  });
  invalidateDemoProtection();
}

/** Writes that are not "editing the demo data" and must keep working while locked:
 *  signing in and out, the emergency buttons (a safety feature is never switched off),
 *  and talking to the voice assistant (its actions go through /voice/execute, which stays blocked). */
const ALLOWED_WHILE_LOCKED = [
  /^\/api\/v1\/auth\/(login|logout|pin-login|send-otp|verify-otp|forgot-password)$/,
  /^\/api\/v1\/demo\/login$/,
  // Marking a dose taken or snoozing it is how the medicine reminder is answered; refusing it would
  // leave the alert nagging for ever.
  /^\/api\/v1\/health\/reminders\/(confirm-batch|[^/]+)$/,
  /^\/api\/v1\/emergency\/sos$/,
  /^\/api\/v1\/community\/panic$/,
  /^\/api\/v1\/voice\/(process|transcribe|speak)$/,
  /^\/api\/v1\/notifications\/register-device$/,
];

export function isAllowedWhileLocked(pathname: string): boolean {
  return ALLOWED_WHILE_LOCKED.some((re) => re.test(pathname));
}
