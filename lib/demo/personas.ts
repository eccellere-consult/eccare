import { MAIN_ACCOUNTS } from './helpers';
import { avatarOf } from './cast';

/** The three demo logins offered on the sign-in page. No password is ever shown or needed:
 *  the "Try the demo" buttons sign in directly (POST /api/v1/demo/login). */
export const DEMO_PERSONAS = [
  { id: 'elder', label: 'Elder', name: MAIN_ACCOUNTS.elder.name, blurb: 'Medicines, SOS, community, orders', email: MAIN_ACCOUNTS.elder.email, avatar: avatarOf('elder') },
  { id: 'family', label: 'Family', name: MAIN_ACCOUNTS.family.name, blurb: 'Look after a parent from anywhere', email: MAIN_ACCOUNTS.family.email, avatar: avatarOf('family') },
  { id: 'provider', label: 'Service provider', name: MAIN_ACCOUNTS.provider.name, blurb: 'Pharmacy orders, catalog and reviews', email: MAIN_ACCOUNTS.provider.email, avatar: avatarOf('pharmacy') },
] as const;

export type DemoPersonaId = (typeof DEMO_PERSONAS)[number]['id'];
