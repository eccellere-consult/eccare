/** Fixed platform-wide rates per review frequency — no real-estate valuation
 *  integration exists to price a per-property quote automatically, so this is
 *  a flat rate table rather than an admin rate-management screen. Revisit if
 *  pricing ever needs to vary by property/community. */
export const PROPERTY_REVIEW_RATES: Record<'monthly' | 'quarterly' | 'biannually', number> = {
  monthly: 999,
  quarterly: 2499,
  biannually: 4499,
};
