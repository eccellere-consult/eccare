import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Every consultation assigned to the caller's own AdvisoryExpert profile —
 *  the expert sees the intake details and any vault documents directly,
 *  instead of the platform team relaying everything by phone/email (the
 *  no-login path this replaces for self-registered experts). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'provider') return fail('FORBIDDEN', 'Providers only.', 403);

  const provider = await prisma.serviceProvider.findUnique({ where: { userId: auth.userId } });
  if (!provider) return fail('NOT_FOUND', 'Provider profile not found.', 404);

  const expert = await prisma.advisoryExpert.findUnique({ where: { providerId: provider.id } });
  if (!expert) return fail('NOT_FOUND', 'Your advisory profile is created once your account is verified.', 404);

  const consultations = await prisma.consultationRequest.findMany({
    where: { assignedExpertId: expert.id },
    include: {
      elderUser: { select: { name: true, phone: true } },
      documents: { select: { id: true, fileName: true, filePath: true, fileType: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: consultations });
}
