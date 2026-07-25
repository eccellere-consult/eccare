import * as Speech from 'expo-speech';
import { api } from './api';

export type VoiceAction =
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

interface VoiceResult {
  intent: VoiceAction;
  response: string;
  action: VoiceAction;
  actionData?: Record<string, unknown>;
}

export async function processVoice(transcript: string): Promise<VoiceResult> {
  return api.post('/voice/process', { transcript });
}

export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(text, {
      language: 'en-IN',
      rate: 0.85,
      pitch: 1.0,
      onDone: resolve,
      onError: () => resolve(),
    });
  });
}

export function stopSpeaking() {
  Speech.stop();
}
