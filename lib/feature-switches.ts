import { prisma } from '@/lib/db';
import { ALL_OFF, FEATURE_KEYS, type FeatureKey, type FeatureSwitches } from '@/lib/feature-switches-shared';

export { ALL_OFF, FEATURE_KEYS, type FeatureKey, type FeatureSwitches };

/**
 * Launch switches for features that are built but kept Off until launch day.
 * Each is one FeatureSwitch row; a missing row means Off.
 *  - care_staff: verified home-care staff (nurses, doctors, security, cooks, house help)
 *  - offers: provider offers and paid ad space
 * Admin pages are always reachable so the team can review and set up before switching On.
 */
export async function getFeatureSwitches(): Promise<FeatureSwitches> {
  try {
    const rows = await prisma.featureSwitch.findMany({ where: { key: { in: [...FEATURE_KEYS] } } });
    const on = (k: FeatureKey) => rows.some((r) => r.key === k && r.enabled);
    return { careStaff: on('care_staff'), offers: on('offers') };
  } catch {
    // A database hiccup must never break page layouts: treat everything as Off.
    return ALL_OFF;
  }
}

export async function isFeatureOn(key: FeatureKey): Promise<boolean> {
  const row = await prisma.featureSwitch.findUnique({ where: { key } });
  return row?.enabled ?? false;
}

export async function setFeature(key: FeatureKey, enabled: boolean, updatedById: string): Promise<boolean> {
  const row = await prisma.featureSwitch.upsert({
    where: { key },
    update: { enabled, updatedById },
    create: { key, enabled, updatedById },
  });
  return row.enabled;
}
