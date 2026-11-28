// Offers and paid ad space from providers. Pure (no imports) so the API, the screens and the
// tests share the same rules.
//
// A provider makes an offer (shown in the calm "Offers" section) or buys an ad slot (one quiet
// "Sponsored" card at the top of Offers or of the Services page). They pay first; EC approves
// before anyone sees it; a rejected one is refunded in full. Ads never appear on health,
// medicine or SOS screens: those placements simply do not exist.

export const PLACEMENTS = ['offer', 'offers_top', 'services_top'] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PLACEMENT_INFO: Record<Placement, { label: string; hint: string; defaultPricePer30Days: number }> = {
  offer: { label: 'Offer in the Offers section', hint: 'Listed with other offers. Elders and families open Offers when they want to.', defaultPricePer30Days: 499 },
  offers_top: { label: 'Ad: top of the Offers section', hint: 'One "Sponsored" card above all offers.', defaultPricePer30Days: 999 },
  services_top: { label: 'Ad: top of the Services page', hint: 'One "Sponsored" card at the top of Services.', defaultPricePer30Days: 1499 },
};

export const DURATIONS = [7, 15, 30] as const;
export type Duration = (typeof DURATIONS)[number];

export const CAMPAIGN_STATUSES = ['draft', 'in_review', 'live', 'rejected', 'ended', 'taken_down'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Not paid yet',
  in_review: 'Paid, waiting for EC approval',
  live: 'Showing now',
  rejected: 'Not approved (refunded)',
  ended: 'Ended',
  taken_down: 'Taken down by EC',
};

export const MAX_IMAGES = 4;

/** The price for a number of days, from the price for 30 days, rounded up to the rupee. */
export function priceFor(pricePer30Days: number, days: number): number {
  if (!(pricePer30Days > 0) || !(days > 0)) return 0;
  return Math.ceil((pricePer30Days * days) / 30);
}

/** Only https links to YouTube, Instagram or Facebook videos (opened in their own app; never
 *  played inside EC, so nothing starts by itself). Returns the cleaned link or null. */
export function cleanVideoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\.|^m\./, '');
  const ok = ['youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'fb.watch'].includes(host);
  return ok ? url.toString() : null;
}

/** Status as people should see it: a live campaign past its end date has ended. */
export function effectiveStatus(c: { status: string; endsAt: Date | null }, now: Date): CampaignStatus {
  if (c.status === 'live' && c.endsAt && c.endsAt <= now) return 'ended';
  return (CAMPAIGN_STATUSES as readonly string[]).includes(c.status) ? (c.status as CampaignStatus) : 'draft';
}

export function isShowing(c: { status: string; startsAt: Date | null; endsAt: Date | null }, now: Date): boolean {
  return c.status === 'live' && !!c.startsAt && !!c.endsAt && c.startsAt <= now && now < c.endsAt;
}

/** The run of a campaign approved now: from approval for the days paid for. */
export function liveWindow(approvedAt: Date, days: number): { startsAt: Date; endsAt: Date } {
  return { startsAt: approvedAt, endsAt: new Date(approvedAt.getTime() + days * 24 * 60 * 60 * 1000) };
}

/** Which of several showing ads gets the one slot: a different one each hour, fairly. */
export function pickAd<T extends { id: string }>(ads: T[], now: Date): T | null {
  if (!ads.length) return null;
  const sorted = [...ads].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[Math.floor(now.getTime() / 3_600_000) % sorted.length];
}

/** What is still missing before paying (empty = ready). */
export function missingBeforePay(c: { title: string | null | undefined; offerText: string | null | undefined; contactPhone: string | null | undefined }): string[] {
  const missing: string[] = [];
  if (!c.title || c.title.trim().length < 3) missing.push('A title');
  if (!c.offerText || c.offerText.trim().length < 3) missing.push('The offer in one line');
  if (!c.contactPhone || c.contactPhone.replace(/\D/g, '').length < 10) missing.push('A phone number customers can call');
  return missing;
}
