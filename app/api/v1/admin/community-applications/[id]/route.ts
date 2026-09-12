import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { generateJoinCode, generateLocalityCode } from '@/lib/neighborhood-codes';

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

const fail = (code: string, message: string, status: number) =>
  NextResponse.json({ success: false, error: { code, message } }, { status });

/** Platform admin's decision on a community registration application. On approve,
 *  creates the real Neighborhood plus a claimable admin account for the
 *  applicant — same "unclaimed placeholder" pattern as a family invite
 *  (prisma.user.create with phone/email/name/role, no passwordHash; the
 *  applicant claims it the first time they register with that same phone or
 *  email). All in one transaction, same convention as
 *  admin/provider-requests/[id]/route.ts. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return fail('UNAUTHORIZED', 'Please log in.', 401);
  if (auth.role !== 'admin') return fail('FORBIDDEN', 'Admins only.', 403);

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return fail('INVALID_INPUT', 'Please check the details and try again.', 400);

  const application = await prisma.communityApplication.findUnique({ where: { id } });
  if (!application) return fail('NOT_FOUND', 'Application not found.', 404);
  if (application.status !== 'pending') {
    return fail('ALREADY_DECIDED', 'This application has already been decided.', 409);
  }

  if (parsed.data.action === 'reject') {
    const updated = await prisma.communityApplication.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason: parsed.data.rejectionReason,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  // action === 'approve'
  const existingByPhone = await prisma.user.findUnique({ where: { phone: application.applicantPhone } });
  const existingByEmail =
    application.applicantEmail && !existingByPhone
      ? await prisma.user.findUnique({ where: { email: application.applicantEmail } })
      : null;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      let applicantUser = existingByPhone ?? existingByEmail;
      if (!applicantUser) {
        applicantUser = await tx.user.create({
          data: {
            phone: application.applicantPhone,
            email: application.applicantEmail,
            name: application.applicantName,
            role: 'caregiver',
          },
        });
      }

      let joinCode = '';
      let localityCode = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidateJoinCode = generateJoinCode();
        const candidateLocalityCode = generateLocalityCode(application.pincode);
        const [joinCodeTaken, localityCodeTaken] = await Promise.all([
          tx.neighborhood.findUnique({ where: { joinCode: candidateJoinCode } }),
          tx.communityApplication.findUnique({ where: { localityCode: candidateLocalityCode } }),
        ]);
        if (!joinCodeTaken && !localityCodeTaken) {
          joinCode = candidateJoinCode;
          localityCode = candidateLocalityCode;
          break;
        }
      }
      if (!joinCode) throw new Error('Could not generate a unique code — please try again.');

      const neighborhood = await tx.neighborhood.create({
        data: {
          name: application.placeName,
          city: application.city,
          pincode: application.pincode,
          joinCode,
          members: { create: { userId: applicantUser.id, role: 'admin' } },
        },
      });

      return tx.communityApplication.update({
        where: { id },
        data: {
          status: 'approved',
          localityCode,
          neighborhoodId: neighborhood.id,
          reviewedById: auth.userId,
          reviewedAt: new Date(),
        },
        include: { neighborhood: true },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not approve the application.';
    return fail('SERVER_ERROR', message, 500);
  }
}
