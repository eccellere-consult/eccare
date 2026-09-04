import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { canAccessElder } from '@/lib/family-access';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  relationship: z.string().min(1),
  callOrder: z.number().int().min(1).optional(),
  notifyOnSos: z.boolean().optional(),
  elderUserId: z.string().optional(),
  // "Emergency Contact Matrix" — linking a registered volunteer or family member
  // (not just free-text name/phone) with a priority level. Capped at 3 per
  // elder, one per priorityLevel, enforced below (Prisma has no "max N rows"
  // schema constraint).
  linkedUserId: z.string().optional(),
  priorityLevel: z.enum(['primary', 'secondary', 'backup']).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const elderUserId = req.nextUrl.searchParams.get('elderUserId') || auth.userId;

  if (!(await canAccessElder(auth.userId, elderUserId))) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this elder's contacts." } },
      { status: 403 },
    );
  }

  const contacts = await prisma.emergencyContact.findMany({
    where: { userId: elderUserId },
    orderBy: { callOrder: 'asc' },
  });

  return NextResponse.json({ success: true, data: contacts });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Please fill in all required fields.' } },
      { status: 400 },
    );
  }

  // Allow caregivers to add contacts for their linked elders
  const targetUserId = parsed.data.elderUserId || auth.userId;

  if (!(await canAccessElder(auth.userId, targetUserId))) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: "You don't have access to this elder's contacts." } },
      { status: 403 },
    );
  }

  const { linkedUserId, priorityLevel } = parsed.data;

  if (linkedUserId || priorityLevel) {
    if (!linkedUserId || !priorityLevel) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'A priority level requires linking a registered volunteer or family member, and vice versa.' } },
        { status: 400 },
      );
    }

    const existingLinked = await prisma.emergencyContact.findMany({
      where: { userId: targetUserId, linkedUserId: { not: null } },
      select: { linkedUserId: true, priorityLevel: true },
    });
    if (existingLinked.length >= 3) {
      return NextResponse.json(
        { success: false, error: { code: 'MATRIX_FULL', message: 'Up to 3 registered volunteers or family members can be linked — remove one first to add another.' } },
        { status: 409 },
      );
    }
    if (existingLinked.some((c) => c.linkedUserId === linkedUserId)) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_LINKED', message: 'This person is already linked as an emergency contact.' } },
        { status: 409 },
      );
    }
    if (existingLinked.some((c) => c.priorityLevel === priorityLevel)) {
      return NextResponse.json(
        { success: false, error: { code: 'PRIORITY_TAKEN', message: `Someone is already set as ${priorityLevel} — change theirs first.` } },
        { status: 409 },
      );
    }
  }

  const contact = await prisma.emergencyContact.create({
    data: {
      userId: targetUserId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      relationship: parsed.data.relationship,
      callOrder: parsed.data.callOrder ?? 1,
      notifyOnSos: parsed.data.notifyOnSos ?? true,
      linkedUserId,
      priorityLevel,
    },
  });

  return NextResponse.json({ success: true, data: contact }, { status: 201 });
}
