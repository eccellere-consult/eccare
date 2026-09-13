// Deliberately dependency-free — imported by both client-side pages that
// compose a WhatsApp message (auto-booking, doctor booking, the emergency
// Police button, the admin invite composer and its own editor) and the
// server-side API routes. Pulled out of lib/whatsapp-templates.ts specifically
// so the client bundle never needs to resolve `@/lib/db` (Prisma), same
// reasoning as lib/voice-shared.ts vs lib/claude.ts.

/** The fixed set of editable WhatsApp message templates — every place in the
 *  app that pre-fills a wa.me message pulls its body from here (via
 *  GET /api/v1/whatsapp-templates) instead of a hardcoded string, so an
 *  admin can edit and save the wording without a code change. Adding a new
 *  templated message elsewhere means adding one entry here and switching
 *  that call site to use it — the key is the only thing that has to match
 *  between here and the consumer. */
export type WhatsAppTemplateKey = 'invite' | 'auto_booking_request' | 'doctor_booking_confirm' | 'emergency_help';

export interface WhatsAppTemplateDef {
  key: WhatsAppTemplateKey;
  label: string;
  /** Explains where this is sent and what {{placeholders}} it supports —
   *  shown to the admin above the editor, since an unrecognized placeholder
   *  left in the saved text just renders literally (see renderTemplate). */
  description: string;
  defaultBody: string;
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplateDef[] = [
  {
    key: 'invite',
    label: 'Registration invite',
    description:
      'Sent from Admin → WhatsApp Invite, to invite someone to register on EC. Placeholders: {{name}}, {{link}}, {{community_line}} (a line naming the community + join code, blank if none was picked).',
    defaultBody: [
      'EC — Just Easy. 👵👴',
      '',
      'Hi {{name}},',
      '',
      '✅ One-tap SOS with live location, straight to family',
      '✅ Medicine reminders that actually notify family too',
      '✅ A neighbours directory and community notices',
      '✅ Local shops, services, and doctors in one place',
      '',
      'Register here: {{link}}',
      '{{community_line}}',
    ].join('\n'),
  },
  {
    key: 'auto_booking_request',
    label: 'Auto booking request',
    description:
      'Sent to a local auto-rickshaw driver when an elder/caregiver requests a trip. Placeholders: {{trip}} (Drop only / Go there & come back), {{pickup}}, {{drop}}, {{date_line}} (blank if no date given), {{rate_line}} (blank if no rate on file).',
    defaultBody: [
      'Hello, I need to book your auto through EC.',
      'Trip: {{trip}}',
      'Pickup: {{pickup}}',
      'Drop: {{drop}}',
      '{{date_line}}',
      '{{rate_line}}',
      'Please reply to confirm you can take this trip. Thank you!',
    ].join('\n'),
  },
  {
    key: 'doctor_booking_confirm',
    label: 'Doctor appointment confirmation',
    description:
      "Sent to the clinic's phone when an elder/caregiver books an appointment slot. Placeholders: {{patient}}, {{time}}, {{fee}}.",
    defaultBody: [
      'Hello, I would like to confirm an appointment booked through EC.',
      'Patient: {{patient}}',
      'Requested time: {{time}}',
      'Consultation fee: ₹{{fee}}',
      'Please call or reply to confirm this slot. Thank you!',
    ].join('\n'),
  },
  {
    key: 'emergency_help',
    label: 'Emergency "need help" alert',
    description:
      'Sent to the primary emergency contact when the elder taps Call Police. Placeholders: {{location}} (a "My location: <maps link>" line, blank if location was unavailable).',
    defaultBody: 'This is an emergency, I need help.{{location}}',
  },
];

const TEMPLATE_BY_KEY = new Map(WHATSAPP_TEMPLATES.map((t) => [t.key, t]));

export function getTemplateDef(key: WhatsAppTemplateKey): WhatsAppTemplateDef {
  const def = TEMPLATE_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown WhatsApp template key: ${key}`);
  return def;
}

/** Fills {{token}} placeholders from `vars` — an unrecognized token (a typo,
 *  or one left over from a template the admin edited carelessly) is left in
 *  place rather than silently deleted, so a broken template is obviously
 *  broken rather than quietly missing words. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, token) => (token in vars ? vars[token] : match));
}
