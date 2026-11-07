import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { isValidPhone, isValidEmail, normalizePhone, PHONE_FORMAT_MESSAGE, EMAIL_FORMAT_MESSAGE } from '@/lib/validation';
import { PARTNER_INTEREST_VALUES, notifyTeamOfEnquiry, tooManyEnquiries } from '@/lib/partner-enquiry';

const fail = (code: string, message: string, status = 400) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

const schema = z.object({
  interest: z.enum(PARTNER_INTEREST_VALUES),
  name: z.string().trim().min(2, 'Please enter your name.').max(100),
  organisation: z.string().trim().max(150).optional(),
  phone: z.string().trim(),
  email: z.string().trim().max(150).optional(),
  message: z.string().trim().min(10, 'Please tell us a little about what you have in mind.').max(2000),
  // Hidden field a person never sees; automated form-fillers tend to fill it in.
  companyUrl: z.string().optional(),
});

/** Public, unauthenticated: a company or person who wants to support EC (CSR funding, sponsoring
 *  free access for elders, community or offline-support partnerships) writes to us from /partner.
 *  Nothing is paid here. The enquiry is saved for Admin > Partner enquiries and, once the email
 *  service is set up, emailed to the team too. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'Please check the form and try again.');
  const d = parsed.data;

  // A filled hidden field means a script, not a person: pretend it worked and store nothing.
  if (d.companyUrl) return NextResponse.json({ success: true, data: { received: true } }, { status: 201 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (tooManyEnquiries(ip)) return fail('RATE_LIMITED', 'We have received several messages from you already. Please try again in an hour.', 429);

  if (!isValidPhone(d.phone)) return fail('VALIDATION', PHONE_FORMAT_MESSAGE);
  if (d.email && !isValidEmail(d.email)) return fail('VALIDATION', EMAIL_FORMAT_MESSAGE);

  const enquiry = await prisma.partnerEnquiry.create({
    data: {
      interest: d.interest,
      name: d.name,
      organisation: d.organisation || null,
      phone: normalizePhone(d.phone),
      email: d.email || null,
      message: d.message,
    },
  });

  // The enquiry is already safe in the database; a failed or skipped email never fails the request.
  try {
    if (await notifyTeamOfEnquiry(enquiry)) {
      await prisma.partnerEnquiry.update({ where: { id: enquiry.id }, data: { notifiedAt: new Date() } });
    }
  } catch (err) {
    console.error('[partner-enquiry] team email failed:', err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ success: true, data: { received: true } }, { status: 201 });
}
