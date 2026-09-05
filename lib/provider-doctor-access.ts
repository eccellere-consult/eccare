import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Confirms the caller is a provider and the given LocalDoctor row is their
 *  own (providerId matches their ServiceProvider row) — shared by every
 *  self-service doctor route (profile, photo, slots, bookings). */
export async function requireOwnDoctor(auth: { userId: string }, doctorId: string) {
  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return { error: fail('NOT_FOUND', 'Provider profile not found.', 404) } as const;

  const doctor = await prisma.localDoctor.findUnique({ where: { id: doctorId } });
  if (!doctor) return { error: fail('NOT_FOUND', 'Listing not found.', 404) } as const;
  if (doctor.providerId !== provider.id) return { error: fail('FORBIDDEN', "This isn't your listing.", 403) } as const;

  return { provider, doctor } as const;
}
