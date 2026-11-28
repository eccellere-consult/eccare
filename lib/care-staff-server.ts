import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { askFirstAvailable, type MediaType } from '@/lib/catalog-ai';
import { CARE_STAFF_CATEGORY, certificateNote, parseCertificateRead } from '@/lib/care-staff';

export const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** The signed-in provider's own row, only when they registered as home-care staff. */
export async function careStaffProviderFor(userId: string) {
  const provider = await prisma.serviceProvider.findUnique({
    where: { userId },
    select: { id: true, category: true, businessName: true, verificationStatus: true },
  });
  return provider && provider.category === CARE_STAFF_CATEGORY.value ? provider : null;
}

export const LISTING_INCLUDE = {
  documents: {
    select: { id: true, kind: true, fileName: true, contentType: true, expiresOn: true, aiNote: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
  rates: { orderBy: { unit: 'asc' as const } },
};

type ListingRow = {
  expectedSalary: unknown;
  rates: { id: string; unit: string; proposedAmount: unknown; approvedAmount: unknown; note: string | null }[];
  [k: string]: unknown;
};

/** Decimal columns as plain numbers for the screens. */
export function serialiseListing<T extends ListingRow>(l: T) {
  return {
    ...l,
    expectedSalary: l.expectedSalary == null ? null : Number(l.expectedSalary),
    rates: l.rates.map((r) => ({
      ...r,
      proposedAmount: Number(r.proposedAmount),
      approvedAmount: r.approvedAmount == null ? null : Number(r.approvedAmount),
    })),
  };
}

const CERT_PROMPT = `This photo should be a skill or competency certificate (for example a nursing diploma,
a nursing council or medical council registration, or a training certificate) of a home-care worker in India.
Read ONLY what is printed. Reply with JSON only, no other words:
{"name": "the person's name exactly as printed, or empty",
 "qualification": "the qualification or course, or empty",
 "registrationNumber": "registration or certificate number, or empty",
 "expiresOn": "the valid-until / expiry / renewal date as YYYY-MM-DD, or empty if none is printed",
 "looksLikeCertificate": true or false}
Never guess. If something is not clearly printed, leave it empty.`;

/** Asks the AI to read a certificate photo. Returns the admin note and any expiry date found,
 *  or null when no AI is set up or it failed (the upload still succeeds; the admin reads it). */
export async function readCertificate(
  bytes: Buffer,
  contentType: string,
  personName: string,
): Promise<{ note: string; expiresOn: Date | null } | null> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return null;
  const text = await askFirstAvailable(bytes.toString('base64'), contentType as MediaType, CERT_PROMPT, 400, {
    capability: 'care_staff_certificate_read',
    module: 'care_staff',
  });
  if (text === null) return null;
  const read = parseCertificateRead(text);
  if (!read) return null;
  return {
    note: certificateNote(read, personName),
    expiresOn: read.expiresOn ? new Date(`${read.expiresOn}T00:00:00Z`) : null,
  };
}
