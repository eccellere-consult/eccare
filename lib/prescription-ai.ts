import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface ExtractedMedication {
  name: string;
  dosage: string;
  frequency: string;
  timeSlots: string[];
  instructions: string | null;
  duration: string | null;
}

export interface PrescriptionExtraction {
  doctorName: string | null;
  hospitalName: string | null;
  prescriptionDate: string | null;
  medications: ExtractedMedication[];
  notes: string | null;
  nextVisitDate: string | null;
}

// Today's date is injected so the model can resolve relative follow-ups (e.g. "review after 2 weeks") to an absolute date.
function buildExtractionPrompt(today: string): string {
  return `You are a medical prescription reader for an elder care platform. Extract structured medication data from this prescription image. Today's date is ${today}.

Return ONLY a valid JSON object with this exact shape:
{
  "doctorName": "Dr. Name" or null,
  "hospitalName": "Hospital/Clinic name" or null,
  "prescriptionDate": "YYYY-MM-DD" or null,
  "medications": [
    {
      "name": "Medicine name (generic or brand)",
      "dosage": "e.g. 500mg, 10ml",
      "frequency": "e.g. Once daily, Twice daily, Three times daily",
      "timeSlots": ["08:00", "20:00"],
      "instructions": "e.g. After meals, Before bed" or null,
      "duration": "e.g. 30 days, 2 weeks" or null
    }
  ],
  "notes": "Any other relevant notes from the prescription" or null,
  "nextVisitDate": "YYYY-MM-DD" or null
}

Rules:
- timeSlots must be in 24-hour "HH:MM" format
- For "once daily" use ["08:00"], "twice daily" use ["08:00", "20:00"], "three times daily" use ["08:00", "14:00", "20:00"]
- If a time is specified (e.g. "at bedtime"), use the appropriate time like ["21:00"]
- If the image is not a prescription or is unreadable, return: {"doctorName":null,"hospitalName":null,"prescriptionDate":null,"medications":[],"notes":"Could not read prescription. Please upload a clearer image.","nextVisitDate":null}
- Extract ALL medications listed, do not skip any
- Be accurate with dosage and frequency — these affect patient safety
- If the prescription mentions a follow-up/review/next visit (e.g. "review after 2 weeks", "come back on 15/09"), resolve it to an absolute "YYYY-MM-DD" date using today's date and put it in nextVisitDate. If no follow-up is mentioned, use null`;
}

const FALLBACK_RESULT: PrescriptionExtraction = {
  doctorName: null,
  hospitalName: null,
  prescriptionDate: null,
  medications: [],
  notes: 'AI could not parse the prescription. Please try a clearer photo.',
  nextVisitDate: null,
};

function parseExtraction(text: string): PrescriptionExtraction {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { ...FALLBACK_RESULT };

  try {
    const parsed = JSON.parse(jsonMatch[0]) as PrescriptionExtraction;
    if (!Array.isArray(parsed.medications)) parsed.medications = [];
    if (parsed.nextVisitDate === undefined) parsed.nextVisitDate = null;
    return parsed;
  } catch {
    return { ...FALLBACK_RESULT, notes: 'AI returned invalid data. Please try again.' };
  }
}

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

async function extractWithAnthropic(
  imageBase64: string,
  mediaType: MediaType,
): Promise<PrescriptionExtraction> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: buildExtractionPrompt(new Date().toISOString().split('T')[0]) },
        ],
      },
    ],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseExtraction(text);
}

async function extractWithOpenAI(
  imageBase64: string,
  mediaType: MediaType,
): Promise<PrescriptionExtraction> {
  const client = new OpenAI();
  const dataUrl = `data:${mediaType};base64,${imageBase64}`;
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          { type: 'text', text: buildExtractionPrompt(new Date().toISOString().split('T')[0]) },
        ],
      },
    ],
  });
  const text = response.choices[0]?.message?.content ?? '';
  return parseExtraction(text);
}

async function extractWithGrok(
  imageBase64: string,
  mediaType: MediaType,
): Promise<PrescriptionExtraction> {
  const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  });
  const dataUrl = `data:${mediaType};base64,${imageBase64}`;
  const response = await client.chat.completions.create({
    model: 'grok-2-vision-1212',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          { type: 'text', text: buildExtractionPrompt(new Date().toISOString().split('T')[0]) },
        ],
      },
    ],
  });
  const text = response.choices[0]?.message?.content ?? '';
  return parseExtraction(text);
}

type Provider = { name: string; available: () => boolean; extract: (b64: string, mt: MediaType) => Promise<PrescriptionExtraction> };

const PROVIDERS: Provider[] = [
  { name: 'anthropic', available: () => !!process.env.ANTHROPIC_API_KEY, extract: extractWithAnthropic },
  { name: 'openai', available: () => !!process.env.OPENAI_API_KEY, extract: extractWithOpenAI },
  { name: 'grok', available: () => !!process.env.XAI_API_KEY, extract: extractWithGrok },
];

export async function extractPrescription(
  imageBase64: string,
  mediaType: MediaType,
): Promise<PrescriptionExtraction & { provider?: string }> {
  const errors: string[] = [];

  for (const provider of PROVIDERS) {
    if (!provider.available()) continue;
    try {
      const result = await provider.extract(imageBase64, mediaType);
      return { ...result, provider: provider.name };
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length > 0) {
    return {
      ...FALLBACK_RESULT,
      notes: `AI extraction failed across all providers. Errors: ${errors.join('; ')}. Please add medications manually.`,
    };
  }

  return {
    ...FALLBACK_RESULT,
    notes: 'No AI provider configured. Please add medications manually.',
  };
}

export function isConfigured(): boolean {
  return PROVIDERS.some((p) => p.available());
}

export function configuredProviders(): string[] {
  return PROVIDERS.filter((p) => p.available()).map((p) => p.name);
}
