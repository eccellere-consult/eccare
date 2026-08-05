import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createToken, hashPassword, setSessionCookie, toSafeUser } from '@/lib/auth';
import { z } from 'zod';

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
    phone: z.string().min(7).max(20),
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
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please check your details and try again.' } },
      { status: 400 },
    );
  }

  const { email, password, name, phone, role, businessName, category } = parsed.data;
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({ where: { email } });
  let user;
  try {
    if (existing) {
      // Providers have no invite-based placeholder flow (unlike elder/caregiver, whose
      // account may already exist unclaimed from a family invite), so any existing row
      // for this email is always a real, already-claimed account.
      if (existing.passwordHash || role === 'provider') {
        return NextResponse.json(
          { success: false, error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' } },
          { status: 409 },
        );
      }
      if (existing.role !== role) {
        return NextResponse.json(
          { success: false, error: { code: 'ROLE_MISMATCH', message: 'This email was already invited with a different role.' } },
          { status: 409 },
        );
      }
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name, phone: phone ?? existing.phone },
      });
    } else if (role === 'provider') {
      // A pending ServiceProvider profile is created in the same transaction so a
      // provider account is never left ungated.
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { email, passwordHash, name, phone, role } });
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
      user = await prisma.user.create({ data: { email, passwordHash, name, phone, role } });
    }
  } catch (err) {
    // Prisma P2002 — unique constraint (phone already used by another account).
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: { code: 'PHONE_TAKEN', message: 'That phone number is already registered to another account.' } },
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
