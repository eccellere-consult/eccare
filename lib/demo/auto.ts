import { prisma } from '@/lib/db';
import { DEMO_COMMUNITY_CODE } from './helpers';
import { loadDemoData } from './index';

/**
 * First-run loading of the demo, so the three test logins are already full the first time
 * anyone opens the site after a deploy — nobody has to find and click a button.
 *
 * Runs once at server start (see instrumentation.ts) and only when the state is 'pending'.
 * It then becomes 'done'. If an admin removes the demo on purpose the state becomes 'off'
 * and this never loads it again; Load / Refresh from Settings is always available.
 *
 * Several server processes may start together, so the state is claimed with a single
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

export async function ensureDemoLoaded(): Promise<'skipped' | 'loaded' | 'already-there' | 'failed'> {
  const settings = await prisma.platformSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } });
  const state = settings.demoAutoLoad;
  const age = settings.demoAutoLoadAt ? Date.now() - settings.demoAutoLoadAt.getTime() : Infinity;

  const due = (state === 'pending' && age > (settings.demoAutoLoadAt ? RETRY_AFTER_MS : 0)) || (state === 'running' && age > STALE_RUNNING_MS);
  if (!due) return 'skipped';

  const claim = await prisma.platformSettings.updateMany({
    where: { id: 'singleton', demoAutoLoad: state },
    data: { demoAutoLoad: 'running', demoAutoLoadAt: new Date() },
  });
  if (claim.count !== 1) return 'skipped';

  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!admin) {
      await setDemoAutoState('pending');
      return 'skipped';
    }
    const existing = await prisma.neighborhood.findUnique({ where: { joinCode: DEMO_COMMUNITY_CODE }, select: { id: true } });
    if (existing) {
      await setDemoAutoState('done');
      return 'already-there';
    }
    await loadDemoData(admin.id); // sets 'done' itself
    return 'loaded';
  } catch (err) {
    console.error('[demo] first-run load failed:', err);
    await setDemoAutoState('pending').catch(() => {});
    return 'failed';
  }
}
