import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

const createSchema = z.object({
  elderUserId: z.string().optional(),
  doctorName: z.string().min(1),
  hospital: z.string().optional(),
  specialty: z.string().optional(),
  datetime: z.string(), // ISO datetime
  notes: z.string().optional(),
});

const updateSchema = z.object({
  doctorName: z.string().optional(),
  hospital: z.string().optional(),
  specialty: z.string().optional(),
  datetime: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['upcoming', 'completed', 'cancelled']).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const elderUserId = searchParams.get('elderUserId');
  const status = searchParams.get('status');
  const targetUserId = elderUserId || auth.userId;

  const where: any = { userId: targetUserId };
  if (status) {
    where.status = status;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { datetime: 'asc' },
  });

  return NextResponse.json({ success: true, data: appointments });
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

  const { elderUserId, ...appointmentData } = parsed.data;
  const targetUserId = elderUserId || auth.userId;

  // Verify caregiver has permission if creating for someone else
  if (elderUserId && elderUserId !== auth.userId) {
    const relation = await prisma.familyRelation.findFirst({
      where: {
        elderUserId: elderUserId,
        caregiverUserId: auth.userId,
        canViewHealth: true,
        inviteStatus: 'accepted',
      },
    });

    if (!relation) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'No permission to manage appointments for this user.' } },
        { status: 403 },
      );
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      userId: targetUserId,
      ...appointmentData,
      datetime: new Date(appointmentData.datetime),
      status: 'upcoming',
    },
  });

  return NextResponse.json({ success: true, data: appointment }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Appointment ID required.' } },
      { status: 400 },
    );
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Invalid update data.' } },
      { status: 400 },
    );
  }

  // Check ownership/permission
  const existing = await prisma.appointment.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!existing) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found.' } },
      { status: 404 },
    );
  }

  if (existing.userId !== auth.userId) {
    const relation = await prisma.familyRelation.findFirst({
      where: {
        elderUserId: existing.userId,
        caregiverUserId: auth.userId,
        canViewHealth: true,
        inviteStatus: 'accepted',
      },
    });

    if (!relation) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'No permission to update this appointment.' } },
        { status: 403 },
      );
    }
  }

  const updateData: any = { ...parsed.data };
  if (updateData.datetime) {
    updateData.datetime = new Date(updateData.datetime);
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ success: true, data: appointment });
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Please log in.' } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'Appointment ID required.' } },
      { status: 400 },
    );
  }

  // Check ownership/permission
  const existing = await prisma.appointment.findUnique({
    where: { id },
  });

  if (!existing) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found.' } },
      { status: 404 },
    );
  }

  if (existing.userId !== auth.userId) {
    const relation = await prisma.familyRelation.findFirst({
      where: {
        elderUserId: existing.userId,
        caregiverUserId: auth.userId,
        canViewHealth: true,
        inviteStatus: 'accepted',
      },
    });

    if (!relation) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'No permission to delete this appointment.' } },
        { status: 403 },
      );
    }
  }

  await prisma.appointment.delete({ where: { id } });

  return NextResponse.json({ success: true, message: 'Appointment deleted.' });
}
