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
  'set_reminder',
] as const;

export type ConfirmRequiredAction = (typeof CONFIRM_REQUIRED_ACTIONS)[number];

export function isConfirmRequiredAction(action: string): action is ConfirmRequiredAction {
  return (CONFIRM_REQUIRED_ACTIONS as readonly string[]).includes(action);
}
