import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createToken, hashPassword, setSessionCookie, toSafeUser } from '@/lib/auth';
import { z } from 'zod';
import { isValidEmail, isValidPhone, normalizePhone, EMAIL_FORMAT_MESSAGE, PHONE_FORMAT_MESSAGE } from '@/lib/validation';

// Phone is the primary identifier — required, and the default way people sign in.
// Email is optional: useful for password-recovery links and directory contact, but
// not everyone has one they check, so it can't be a hard requirement to register.
const schema = z
  .object({
    email: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || isValidEmail(v), EMAIL_FORMAT_MESSAGE),
    password: z.string().min(8),
    name: z.string().min(1),
    phone: z.string().min(1).refine(isValidPhone, PHONE_FORMAT_MESSAGE),
    role: z.enum(['elder', 'caregiver', 'provider']),
    businessName: z.string().min(1).max(160).optional(),
    category: z.string().min(1).max(80).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'provider') {
      if (!data.businessName) {
        ctx.addIssue({ code: 'custom', path: ['businessName'], message: 'Business name is required.' });
      }
      if (!data.category) {
        ctx.addIssue({ code: 'custom', path: ['category'], message: 'Category is required.' });
      }
    }
  });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message || 'Please check your details and try again.' } },
      { status: 400 },
    );
  }

  const { email, password, name, role, businessName, category } = parsed.data;
  const phone = normalizePhone(parsed.data.phone);
  const passwordHash = await hashPassword(password);

  // A pre-existing row can be a real, already-claimed account, or an unclaimed
  // placeholder (created by a family invite by phone or email, no password ever
  // set). Phone is the primary identifier, so it's checked first; email is a
  // secondary lookup for people who were invited by email only.
  const existingByPhone = await prisma.user.findUnique({ where: { phone } });
  const existingByEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;

  if (existingByPhone && existingByEmail && existingByPhone.id !== existingByEmail.id) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'IDENTIFIER_CONFLICT',
          message: 'That phone number and email are already registered to two different accounts. Please use just one.',
        },
      },
      { status: 409 },
    );
  }

  const existing = existingByPhone ?? existingByEmail;

  let user;
  try {
    if (existing) {
      // Providers have no invite-based placeholder flow (unlike elder/caregiver, whose
      // account may already exist unclaimed from a family invite), so any existing row
      // for this identifier is always a real, already-claimed account.
      if (existing.passwordHash || role === 'provider') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: existingByPhone ? 'PHONE_TAKEN' : 'EMAIL_TAKEN',
              message: `An account with this ${existingByPhone ? 'phone number' : 'email'} already exists.`,
            },
          },
          { status: 409 },
        );
      }
      if (existing.role !== role) {
        return NextResponse.json(
          { success: false, error: { code: 'ROLE_MISMATCH', message: 'This account was already invited with a different role.' } },
          { status: 409 },
        );
      }
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name, phone, email: email ?? existing.email },
      });
    } else if (role === 'provider') {
      // A pending ServiceProvider profile is created in the same transaction so a
      // provider account is never left ungated.
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { email, phone, passwordHash, name, role } });
        await tx.serviceProvider.create({
          data: {
            userId: created.id,
            businessName: businessName!,
            category: category!,
            verificationStatus: 'pending',
          },
        });
        return created;
      });
    } else {
      user = await prisma.user.create({ data: { email, phone, passwordHash, name, role } });
    }
  } catch (err) {
    // Prisma P2002 — unique constraint (phone or email already used by another account).
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      const target = 'meta' in err && err.meta && typeof err.meta === 'object' && 'target' in err.meta ? String(err.meta.target) : '';
      const isEmail = target.includes('email');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: isEmail ? 'EMAIL_TAKEN' : 'PHONE_TAKEN',
            message: `That ${isEmail ? 'email' : 'phone number'} is already registered to another account.`,
          },
        },
        { status: 409 },
      );
    }
    throw err;
  }

  const token = await createToken(user.id, user.role);
  const res = NextResponse.json({ success: true, data: { user: toSafeUser(user), token } }, { status: 201 });
  setSessionCookie(res, token);
  return res;
}
