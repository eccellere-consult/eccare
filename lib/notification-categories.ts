/**
 * Categories a resident can independently opt in/out of.
 *
 * Emergency/panic alerts are deliberately absent — those are not optional in a
 * safety product, and offering a switch for them would imply they can be silenced.
 *
 * Lives here rather than in the route file because Next.js only permits HTTP method
 * exports (and a fixed set of route config keys) from `route.ts`; exporting anything
 * else fails the production build with an unhelpful `OmitWithTag` type error.
 */
export const NOTIFICATION_CATEGORIES = [
  { key: 'announcements', label: 'Announcements', description: 'Notices from the management committee' },
  { key: 'events', label: 'Community events', description: 'New events and reminders' },
  { key: 'chat', label: 'Community Buzz', description: 'New messages in the community chat' },
  { key: 'greetings', label: 'Hellos from neighbours', description: 'When a neighbour says hello' },
  { key: 'queries', label: 'My queries', description: 'Replies to queries you raised' },
] as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORIES)[number]['key'];
