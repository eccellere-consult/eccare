/**
 * Canonical service-provider categories, shown as a dropdown at registration
 * and on the provider's own profile page — replacing what used to be a bare
 * free-text field. `value` is what's actually stored in
 * ServiceProvider.category (still a plain string column, not a DB enum, so
 * adding a category here never needs a migration); `label` is what's shown.
 *
 * 'doctor' and 'auto_transport' match the values already stored on
 * ServiceProvider rows created by lib/provider-directory.ts (the admin-added
 * LocalDoctor/AutoDriver placeholder accounts from before self-service
 * existed for these categories) — kept as-is so existing rows don't end up
 * on a different value than new self-registered ones.
 *
 * 'other' is the escape hatch: picking it reveals a free-text input (same
 * "which has a text input possible" requirement as every category list needs
 * one), and the typed value is stored directly as the category.
 */
export const PROVIDER_CATEGORIES = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'auto_transport', label: 'Auto & Taxi' },
  { value: 'legal_help', label: 'Legal Help' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'property_management', label: 'Property Management' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'physiotherapy', label: 'Physiotherapy' },
  { value: 'retail', label: 'Retail' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'food_restaurant', label: 'Food & Restaurant' },
  { value: 'other', label: 'Others' },
] as const;

export type ProviderCategoryValue = (typeof PROVIDER_CATEGORIES)[number]['value'];

export function providerCategoryLabel(value: string): string {
  return PROVIDER_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
