// Deliberately dependency-free — imported by both the client-side voice assistant
// component and server-side voice code (lib/claude.ts, lib/voice-actions.ts, the
// API routes). Pulling this list out of lib/claude.ts specifically avoids the
// client bundle ever needing to resolve `@anthropic-ai/sdk`, which is server-only.

/** Actions that change something or notify someone on the elder's behalf, using
 *  AI-interpreted (not verbatim-dictated) content — the app asks "do this?" before
 *  executing these, rather than acting immediately. Every other action (including
 *  trigger_sos and call_contact) stays auto-execute. */
export const CONFIRM_REQUIRED_ACTIONS = [
  'send_family_message',
  'book_appointment',
  'order_food',
  'order_online',
  'set_reminder',
] as const;

export type ConfirmRequiredAction = (typeof CONFIRM_REQUIRED_ACTIONS)[number];

export function isConfirmRequiredAction(action: string): action is ConfirmRequiredAction {
  return (CONFIRM_REQUIRED_ACTIONS as readonly string[]).includes(action);
}

/** Elder screens Arya can take someone to when they ask where something is
 *  ("where do I see my payments?"). The model only ever picks a key from this
 *  list — the app maps it to a route here, so a hallucinated or malicious value
 *  can never navigate anywhere outside the elder portal. */
export const ELDER_SCREENS = {
  home: { path: '/elder', label: 'Home' },
  contacts: { path: '/elder/contacts', label: 'Contacts' },
  health: { path: '/elder/health', label: 'Health' },
  community: { path: '/community', label: 'Community' },
  services: { path: '/services', label: 'Services' },
  orders: { path: '/elder/orders', label: 'Orders' },
  payments: { path: '/elder/payments', label: 'Payments' },
  memories: { path: '/elder/memories', label: 'Memories' },
  profile: { path: '/elder/profile', label: 'Profile' },
} as const;

export type ElderScreen = keyof typeof ELDER_SCREENS;

export function elderScreenPath(screen: unknown): string | null {
  return typeof screen === 'string' && Object.prototype.hasOwnProperty.call(ELDER_SCREENS, screen)
    ? ELDER_SCREENS[screen as ElderScreen].path
    : null;
}
