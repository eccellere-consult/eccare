// Launch switches, the part screens can use (no database import). See lib/feature-switches.ts.

export const FEATURE_KEYS = ['care_staff', 'offers'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureSwitches {
  careStaff: boolean;
  offers: boolean;
}

export const ALL_OFF: FeatureSwitches = { careStaff: false, offers: false };
