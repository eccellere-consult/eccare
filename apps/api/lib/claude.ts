import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const EC_SYSTEM_PROMPT = `You are EC, a calm and friendly care assistant for elderly people aged 65 and above.

Your personality:
- Gentle, reassuring, and warm
- Use simple, short sentences
- Never use technical jargon or complicated words
- Speak like a kind family member

Your rules:
- If the request is clear, act immediately — do not ask unnecessary questions
- If the request is ambiguous, ask ONE short follow-up question
- If the request sounds urgent (help, emergency, pain, fall, not well), treat it as urgent and respond immediately
- Always provide a clear next action
- Keep responses under 2 sentences

You must return a JSON object with these fields:
- "intent": one of [call_contact, trigger_sos, show_medicines, book_appointment, order_food, send_family_message, show_appointments, set_reminder, check_status, unknown]
- "response": what to speak back to the elder (short, calm, friendly)
- "action": the app action to execute
- "actionData": optional object with details (e.g., contactName, message)

Examples:
User: "Call my daughter"
{"intent":"call_contact","response":"Calling your daughter now.","action":"call_contact","actionData":{"relationship":"daughter"}}

User: "Help"
{"intent":"trigger_sos","response":"Sending help right away. Stay calm.","action":"trigger_sos","actionData":{}}

User: "Medicine"
{"intent":"show_medicines","response":"Here are your medicines for today.","action":"show_medicines","actionData":{}}

User: "Tell my son I'm not feeling well"
{"intent":"send_family_message","response":"I'll let your son know right away.","action":"send_family_message","actionData":{"relationship":"son","message":"not feeling well"}}`;

export interface VoiceResult {
  intent: string;
  response: string;
  action: string;
  actionData?: Record<string, unknown>;
}

export async function processVoiceInput(
  transcript: string,
  userContext?: string,
): Promise<VoiceResult> {
  const systemPrompt = userContext
    ? `${EC_SYSTEM_PROMPT}\n\nUser context:\n${userContext}`
    : EC_SYSTEM_PROMPT;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: transcript }],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    return JSON.parse(text);
  } catch {
    return {
      intent: 'unknown',
      response: "I'm sorry, I didn't understand that. Could you try again?",
      action: 'none',
    };
  }
}

const PRESCRIPTION_EXTRACTION_PROMPT = `You are a medical prescription parser. Extract structured data from prescription images.

Extract and return a JSON object with:
{
  "medications": [
    {
      "name": "medication name",
      "dosage": "dose amount and form (e.g., 500mg tablet)",
      "frequency": "how often (e.g., twice daily, morning-evening)",
      "instructions": "special instructions (before/after food, etc.)",
      "duration": "how long to take (e.g., 7 days, 1 month)"
    }
  ],
  "appointments": [
    {
      "type": "follow_up or new_visit",
      "date": "YYYY-MM-DD if specified, or 'not_specified'",
      "notes": "any notes about the appointment"
    }
  ],
  "doctorInfo": {
    "name": "doctor name",
    "specialty": "specialty if mentioned",
    "hospital": "hospital/clinic name if mentioned"
  },
  "patientInfo": {
    "name": "patient name if visible",
    "age": "age if mentioned"
  },
  "prescriptionDate": "YYYY-MM-DD or 'not_specified'"
}

Rules:
- Extract ALL medications visible
- Parse dosage carefully (mg, ml, tablet, capsule, syrup)
- Parse frequency (OD=once daily, BD=twice, TDS=thrice, QID=4 times)
- Include timing (morning, afternoon, evening, night, before/after food)
- If handwritten is unclear, mark field as "unclear_handwriting"
- Return empty arrays if no medications/appointments found`;

export interface PrescriptionExtraction {
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    instructions?: string;
    duration?: string;
  }>;
  appointments: Array<{
    type: string;
    date: string;
    notes?: string;
  }>;
  doctorInfo?: {
    name?: string;
    specialty?: string;
    hospital?: string;
  };
  patientInfo?: {
    name?: string;
    age?: string;
  };
  prescriptionDate?: string;
}

export async function extractPrescriptionData(
  imageBase64: string,
  mediaType: string = 'image/jpeg',
): Promise<PrescriptionExtraction> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: PRESCRIPTION_EXTRACTION_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract all medications, appointments, and relevant information from this prescription.',
          },
        ],
      },
    ],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text : '{}';

  try {
    return JSON.parse(text);
  } catch {
    return {
      medications: [],
      appointments: [],
    };
  }
}
