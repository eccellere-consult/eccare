import { prisma } from '@/lib/db';
import { DEMO_COMMUNITY_CODE, DEMO_VERSION } from './helpers';
import { loadDemoData } from './index';

/**
 * Keeps the demo loaded without anyone having to press a button:
 *  - the first time the server starts after a deploy it loads the demo ('pending' -> 'done');
 *  - when the demo content has changed in code (DEMO_VERSION) it refreshes the loaded demo once.
 *
 * Runs at server start (see instrumentation.ts). If an admin removes the demo on purpose the
 * state becomes 'off' and none of this ever brings it back; Load / Refresh in Settings is
 * always available.
 *
 * Several server processes may start together, so the work is claimed with a single
 * conditional update — only the process that wins the claim loads anything.
 */
const RETRY_AFTER_MS = 60 * 60_000; // after a failure, wait an hour before trying again
const STALE_RUNNING_MS = 15 * 60_000; // a load that never finished is treated as abandoned

export async function setDemoAutoState(state: 'pending' | 'running' | 'done' | 'off') {
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: { demoAutoLoad: state, demoAutoLoadAt: new Date() },
    create: { id: 'singleton', demoAutoLoad: state, demoAutoLoadAt: new Date() },
  });
}

export async function ensureDemoLoaded(): Promise<'skipped' | 'loaded' | 'refreshed' | 'already-there' | 'failed'> {
  const settings = await prisma.platformSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
  const state = settings.demoAutoLoad;
  const age = settings.demoAutoLoadAt ? Date.now() - settings.demoAutoLoadAt.getTime() : Infinity;

  const firstRunDue = state === 'pending' && age > (settings.demoAutoLoadAt ? RETRY_AFTER_MS : 0);
  const outdated = state === 'done' && settings.demoVersion < DEMO_VERSION;
  const stuck = state === 'running' && age > STALE_RUNNING_MS;
  if (!firstRunDue && !outdated && !stuck) return 'skipped';

  const claim = await prisma.platformSettings.updateMany({
    where: { id: 'singleton', demoAutoLoad: state, demoVersion: settings.demoVersion },
    data: { demoAutoLoad: 'running', demoAutoLoadAt: new Date() },
  });
  if (claim.count !== 1) return 'skipped';

  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!admin) {
      await setDemoAutoState(outdated ? 'done' : 'pending');
      return 'skipped';
    }
    const existing = await prisma.neighborhood.findUnique({ where: { joinCode: DEMO_COMMUNITY_CODE }, select: { id: true } });
    if (existing && !outdated) {
      await setDemoAutoState('done');
      await prisma.platformSettings.update({ where: { id: 'singleton' }, data: { demoVersion: DEMO_VERSION } });
      return 'already-there';
    }
    await loadDemoData(admin.id); // sets 'done' and the version itself
    return outdated ? 'refreshed' : 'loaded';
  } catch (err) {
    console.error('[demo] automatic load failed:', err);
    // Try again later: an outdated demo goes back to 'done' (old version) so the next start retries.
    await setDemoAutoState(outdated ? 'done' : 'pending').catch(() => {});
    return 'failed';
  }
}
