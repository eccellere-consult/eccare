import { MAIN_ACCOUNTS } from './helpers';
import { avatarOf } from './cast';

/** The one demo login offered publicly (the sign-in page and the shareable /demo link). No password is ever shown or needed:
 *  the "Try the demo" buttons sign in directly (POST /api/v1/demo/login). */
export const DEMO_PERSONAS = [
  { id: 'elder', label: 'Elder', name: MAIN_ACCOUNTS.elder.name, blurb: 'Medicines, SOS, community, orders', email: MAIN_ACCOUNTS.elder.email, avatar: avatarOf('elder') },
] as const;

export type DemoPersonaId = (typeof DEMO_PERSONAS)[number]['id'];
