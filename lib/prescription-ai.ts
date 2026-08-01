import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

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
}

const EXTRACTION_PROMPT = `You are a medical prescription reader for an elder care platform. Extract structured medication data from this prescription image.

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
  "notes": "Any other relevant notes from the prescription" or null
}

Rules:
- timeSlots must be in 24-hour "HH:MM" format
- For "once daily" use ["08:00"], "twice daily" use ["08:00", "20:00"], "three times daily" use ["08:00", "14:00", "20:00"]
- If a time is specified (e.g. "at bedtime"), use the appropriate time like ["21:00"]
- If the image is not a prescription or is unreadable, return: {"doctorName":null,"hospitalName":null,"prescriptionDate":null,"medications":[],"notes":"Could not read prescription. Please upload a clearer image."}
- Extract ALL medications listed, do not skip any
- Be accurate with dosage and frequency — these affect patient safety`;

export async function extractPrescription(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
): Promise<PrescriptionExtraction> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      doctorName: null,
      hospitalName: null,
      prescriptionDate: null,
      medications: [],
      notes: 'AI could not parse the prescription. Please try a clearer photo.',
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as PrescriptionExtraction;
    if (!Array.isArray(parsed.medications)) parsed.medications = [];
    return parsed;
  } catch {
    return {
      doctorName: null,
      hospitalName: null,
      prescriptionDate: null,
      medications: [],
      notes: 'AI returned invalid data. Please try again.',
    };
  }
}

export function isConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
