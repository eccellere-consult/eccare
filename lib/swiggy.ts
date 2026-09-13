// Swiggy has no public API for placing orders on a user's behalf — this is a
// "smart referral" deep link only (same reasoning as the plain homepage links
// already used for Porter/Urban Company/etc. in app/services/services-client.tsx),
// pre-filled with a search so the elder/family lands straight on relevant results
// instead of Swiggy's homepage. The elder or family member picks the actual item
// and completes checkout themselves in the real Swiggy app/site — nothing here
// logs in, adds to cart, or pays on their behalf. Swiggy doesn't publish an
// official deep-link/query API, so these URL shapes are best-effort from Swiggy's
// own public web search URLs and may need adjusting if Swiggy changes them.
export type SwiggyCategory = 'food' | 'instamart';

export function buildSwiggySearchUrl(category: SwiggyCategory, query: string): string {
  const q = encodeURIComponent(query.trim());
  return category === 'instamart'
    ? `https://www.swiggy.com/instamart/search?custom_back=true&query=${q}`
    : `https://www.swiggy.com/search?query=${q}`;
}
