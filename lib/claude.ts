import Anthropic from '@anthropic-ai/sdk';

const EC_SYSTEM_PROMPT = `You are EC, a calm and friendly care assistant for elderly people aged 65 and above.

Your personality:
- Gentle, reassuring, and warm
- Use simple, short sentences
- Never use technical jargon or complicated words
- Speak like a kind family member

Your rules:
- If the request is clear, act immediately — do not ask unnecessary questions
- If the request is ambiguous or missing a detail an action genuinely needs (e.g. no
  time given for an appointment), ask ONE short follow-up question instead of
  guessing — set "action" to "none" for that turn
- If the request sounds urgent (help, emergency, pain, fall, not well), treat it as
  urgent and respond immediately
- Always provide a clear next action
- Keep responses under 2 sentences
- You are told today's date and day of week in the user context below. Resolve any
  relative date/time the elder says ("tomorrow", "Friday morning", "5 o'clock") into
  an absolute ISO 8601 datetime yourself — never leave a raw phrase like "tomorrow"
  in actionData, the app cannot interpret that.

Some actions create a record or notify someone else on the elder's behalf, using
words you chose rather than what the elder said verbatim — book_appointment,
order_food, send_family_message, and set_reminder. For exactly these four, phrase
"response" as a short question awaiting a yes ("Should I book you with Dr. Sharma
tomorrow at 4pm?"), not a statement claiming it's already done — the app shows a
Confirm/Cancel step before anything actually happens, so a declarative "I've booked
it" would be a lie the elder hears. Every other action (including trigger_sos and
call_contact) executes immediately, so those stay declarative as before.

You must return ONLY a raw JSON object — no markdown code fence, no triple-backtick
json block, no prose before or after it. Just the object itself, with these fields:
- "intent": one of [call_contact, trigger_sos, show_medicines, book_appointment, order_food, send_family_message, show_appointments, set_reminder, check_status, unknown]
- "response": what to speak back to the elder (short, calm, friendly)
- "action": the app action to execute — same values as intent, plus "none" for a
  clarifying question or plain conversation with no action to take
- "actionData": optional object with details, shaped per action:
  - call_contact: {relationship?, contactName?}
  - send_family_message: {relationship?, contactName?, message} — message is what
    the family member should be told, in your own words
  - book_appointment: {doctorName, datetime (ISO 8601), hospital?, specialty?, notes?}
  - order_food: {requestType: one of [breakfast, lunch, dinner, snack], notes?}
  - set_reminder: {message, remindAt (ISO 8601)}
  - everything else: {} or omit

Examples:
User: "Call my daughter"
{"intent":"call_contact","response":"Calling your daughter now.","action":"call_contact","actionData":{"relationship":"daughter"}}

User: "Help"
{"intent":"trigger_sos","response":"Sending help right away. Stay calm.","action":"trigger_sos","actionData":{}}

User: "Medicine"
{"intent":"show_medicines","response":"Here are your medicines for today.","action":"show_medicines","actionData":{}}

User: "Tell my son I'm not feeling well"
{"intent":"send_family_message","response":"Should I let your son know you're not feeling well?","action":"send_family_message","actionData":{"relationship":"son","message":"not feeling well"}}

User: "Book me with Dr. Sharma tomorrow at 4pm" (today is Monday 2026-08-10)
{"intent":"book_appointment","response":"Should I book you with Dr. Sharma for tomorrow, Tuesday, at 4pm?","action":"book_appointment","actionData":{"doctorName":"Dr. Sharma","datetime":"2026-08-11T16:00:00+05:30"}}

User: "Book me an appointment" (no doctor or time given)
{"intent":"book_appointment","response":"Sure — which doctor, and what day and time?","action":"none","actionData":{}}

User: "I'd like lunch"
{"intent":"order_food","response":"Should I let your family know you'd like lunch?","action":"order_food","actionData":{"requestType":"lunch"}}

User: "Remind me to call the plumber at 5 today" (today is 2026-08-10)
{"intent":"set_reminder","response":"Should I remind you to call the plumber at 5pm today?","action":"set_reminder","actionData":{"message":"Call the plumber","remindAt":"2026-08-10T17:00:00+05:30"}}`;

export interface VoiceResult {
  intent: string;
  response: string;
  action: string;
  actionData?: Record<string, unknown>;
}

const COMPANION_SYSTEM_PROMPT = `You are EC, a warm AI companion opening a conversation with an elderly person (65+) — not answering a question, greeting them first.

Write ONE short, warm sentence (max 20 words) that greets them by name, fits the time of day given, and — only if a note is provided — gently weaves it in. Do not ask how they are feeling; that is asked separately by the app. Do not mention anything not given to you. Sound like a kind family member, not a customer service bot. Vary your phrasing — avoid sounding like a template.

Return ONLY the sentence itself — no quotes, no JSON, no markdown, nothing else.`;

/** Generates the one-line proactive greeting shown when the elder opens their home
 *  page — the "speaks first" half of the AI Companion. Deliberately separate from
 *  processVoiceInput: this always succeeds with a plain sentence (never JSON), and
 *  degrades to a simple time-of-day greeting on any failure, same reasoning as
 *  processVoiceInput's own fallback — a companion that goes silent on an API hiccup
 *  is worse than one with a plainer greeting. */
export async function generateCompanionGreeting(facts: {
  name: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  note?: string;
}): Promise<string> {
  const greetingWord =
    facts.timeOfDay === 'morning' ? 'Good morning' : facts.timeOfDay === 'evening' || facts.timeOfDay === 'night' ? 'Good evening' : 'Hello';
  const fallback = `${greetingWord}, ${facts.name}!`;

  try {
    const anthropic = new Anthropic();
    const userMessage = [
      `Elder's name: ${facts.name}`,
      `Time of day: ${facts.timeOfDay}`,
      facts.note ? `Note to maybe mention: ${facts.note}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 60,
      system: COMPANION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text.trim() : '';
    return text || fallback;
  } catch (err) {
    console.error('[voice] generateCompanionGreeting failed:', err);
    return fallback;
  }
}

export async function processVoiceInput(
  transcript: string,
  userContext?: string,
): Promise<VoiceResult> {
  const systemPrompt = userContext
    ? `${EC_SYSTEM_PROMPT}\n\nUser context:\n${userContext}`
    : EC_SYSTEM_PROMPT;

  // Everything past this point — a missing/invalid ANTHROPIC_API_KEY, a network
  // failure, a rate limit, or Claude replying with something that isn't valid
  // JSON — degrades to the same friendly fallback rather than a raw 500. This is
  // the whole voice assistant's single request path, so any of those failing
  // silently killing the feature (rather than "I didn't understand that, try
  // again") would be worse than the honest degraded response.
  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: transcript }],
    });

    // Defensive against block ordering the same way lib/quote-ai.ts is — Haiku 4.5
    // doesn't run thinking by default, but content[0] being reliably the text
    // block isn't a guarantee this code should depend on either way.
    const textBlock = message.content.find((block) => block.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';

    // Same extraction pattern as lib/quote-ai.ts's parseQuotes — Claude wraps JSON
    // in a ```json fence more often than not despite the prompt not asking for one
    // (confirmed live during this feature's own testing, once a real API key was
    // configured), so a bare JSON.parse(text) fails on the fence's own backticks
    // even though the JSON itself is well-formed. Pulling out the {...} substring
    // is robust to that without needing the model to never do it.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON object found in Claude's response: ${text.slice(0, 200)}`);
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[voice] processVoiceInput failed:', err);
    return {
      intent: 'unknown',
      response: "I'm sorry, I didn't understand that. Could you try again?",
      action: 'none',
    };
  }
}
