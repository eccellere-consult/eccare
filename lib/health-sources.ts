// What the health-bulletin agent may read and cite, and what it writes about.
//
// The allow-list is the first safety layer: the agent's web search is restricted to these domains (a
// domain also covers its sub-domains, so "nih.gov" includes nei.nih.gov and nia.nih.gov), and every
// source a bulletin cites is checked against it again in code (lib/health-bulletin-rules.ts). To trust
// another organisation, add it here — and nowhere else.

export const TRUSTED_SOURCES: Record<string, string> = {
  'who.int': 'World Health Organization',
  'nhs.uk': 'NHS (UK)',
  'nih.gov': 'US National Institutes of Health',
  'medlineplus.gov': 'MedlinePlus (US National Library of Medicine)',
  'cdc.gov': 'US Centers for Disease Control and Prevention',
  'aao.org': 'American Academy of Ophthalmology',
  'mayoclinic.org': 'Mayo Clinic',
  'clevelandclinic.org': 'Cleveland Clinic',
  'health.harvard.edu': 'Harvard Health Publishing',
  'heart.org': 'American Heart Association',
  'diabetes.org': 'American Diabetes Association',
  'alz.org': "Alzheimer's Association",
  'mohfw.gov.in': 'Ministry of Health and Family Welfare, India',
  'nhp.gov.in': 'National Health Portal, India',
  'icmr.gov.in': 'Indian Council of Medical Research',
  'aiims.edu': 'All India Institute of Medical Sciences',
};

export interface HealthTopic {
  id: string;
  label: string;
  /** Extra guidance for the search: who it is for, what angle is useful. */
  hint: string;
}

/** What the agent writes about, in rotation: the topic with the oldest (or no) bulletin goes next. */
export const HEALTH_TOPICS: HealthTopic[] = [
  { id: 'glaucoma', label: 'Glaucoma: protecting your eyesight', hint: 'What glaucoma is, why regular eye checks matter after 40–60, how to look after eyes and stick to treatment.' },
  { id: 'eye-health', label: 'Eye care for older adults (cataract and regular eye tests)', hint: 'Routine eye tests, cataract, diabetic eye care, sun protection, when blurred vision needs a doctor.' },
  { id: 'staying-active', label: 'Staying active in later life', hint: 'Safe, simple physical activity for older adults: walking, stretching, strength and balance; how much and how to start. Mention that people with health conditions should check with their doctor first.' },
  { id: 'fall-prevention', label: 'Preventing falls at home', hint: 'Home safety, footwear, lighting, bathroom safety, balance, vision and medicine reviews with a doctor.' },
  { id: 'diabetes-care', label: 'Living well with diabetes', hint: 'Daily care for older adults with diabetes: foot checks, eye checks, regular tests, food habits common in India.' },
  { id: 'blood-pressure', label: 'Keeping blood pressure healthy', hint: 'Salt, activity, regular checks, why to keep taking prescribed treatment and ask the doctor before any change.' },
  { id: 'heart-health', label: 'Looking after your heart', hint: 'Heart-healthy habits for older adults, and the warning signs of a heart attack that need emergency help.' },
  { id: 'hydration-heat', label: 'Staying hydrated and safe in the heat', hint: 'Heat and dehydration risks for older adults, simple prevention, warning signs of heat illness.' },
  { id: 'sleep', label: 'Sleeping better', hint: 'Sleep habits for older adults, daytime light and activity, when poor sleep needs a doctor.' },
  { id: 'brain-health', label: 'Keeping your memory and mind sharp', hint: 'Evidence-based habits for brain health in later life, staying socially and mentally active, when memory changes need a check-up.' },
  { id: 'hearing', label: 'Hearing care', hint: 'Why hearing checks matter, signs of hearing loss, how it affects safety and loneliness.' },
  { id: 'bone-health', label: 'Strong bones and joints', hint: 'Osteoporosis and arthritis-friendly activity, calcium and vitamin D from food and sunlight, fracture prevention.' },
  { id: 'vaccines', label: 'Vaccines for older adults', hint: 'Which vaccines older adults are usually advised to discuss with their doctor (flu, pneumonia, shingles, tetanus) and why.' },
  { id: 'medicine-safety', label: 'Taking medicines safely', hint: 'Keeping an up-to-date medicine list, using a pill organiser, asking a pharmacist or doctor questions, never sharing medicines. Do NOT give any doses or tell anyone to change a medicine.' },
  { id: 'mental-wellbeing', label: 'Feeling connected and cheerful', hint: 'Loneliness and low mood in later life, simple ways to stay connected, when to talk to a doctor or counsellor.' },
  { id: 'healthy-eating', label: 'Eating well in later life', hint: 'Balanced, practical eating for older adults, protein, fibre, fluids, adapted to Indian meals where the sources do so.' },
  { id: 'oral-health', label: 'Looking after teeth and gums', hint: 'Oral hygiene for older adults, dentures, why mouth health affects the whole body, regular dental checks.' },
];

export function topicById(id: string): HealthTopic | undefined {
  return HEALTH_TOPICS.find((t) => t.id === id);
}

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** True only for https links on a trusted domain or one of its sub-domains. */
export function isTrustedUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return Object.keys(TRUSTED_SOURCES).some((d) => host === d || host.endsWith(`.${d}`));
}

/** "World Health Organization" for a WHO link, and so on. */
export function publisherFor(url: string): string {
  const host = hostOf(url);
  if (!host) return 'Source';
  const domain = Object.keys(TRUSTED_SOURCES).find((d) => host === d || host.endsWith(`.${d}`));
  return domain ? TRUSTED_SOURCES[domain] : host;
}
