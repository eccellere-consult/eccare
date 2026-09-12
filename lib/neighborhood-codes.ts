/** Human-friendly, unambiguous join code — no 0/O or 1/I, since residents read these
 *  aloud and type them by hand. Shared between the existing admin-create-community
 *  route and community-application approval, both of which mint one. */
export function generateJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

/** The formal locality code assigned to an approved CommunityApplication — distinct
 *  from the short resident-facing joinCode above. Structured as EC-<pincode>-<4
 *  random chars> so it's recognizably tied to a real place, not just a random
 *  string, the way an official registration number normally would be. */
export function generateLocalityCode(pincode: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `EC-${pincode}-${suffix}`;
}
