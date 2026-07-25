export type VoiceIntent =
  | 'call_contact'
  | 'trigger_sos'
  | 'show_medicines'
  | 'book_appointment'
  | 'order_food'
  | 'send_family_message'
  | 'show_appointments'
  | 'set_reminder'
  | 'check_status'
  | 'unknown';

export interface VoiceRequest {
  transcript: string;
  userId: string;
}

export interface VoiceResponse {
  intent: VoiceIntent;
  response: string;
  action: string;
  actionData?: Record<string, unknown>;
}

export interface VoiceLog {
  id: string;
  userId: string;
  transcript: string;
  intent: VoiceIntent;
  responseText: string;
  actionTaken: string;
  createdAt: string;
}
