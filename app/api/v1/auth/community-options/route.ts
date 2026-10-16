import { NextRequest, NextResponse } from 'next/server';
import { listJoinableCommunities } from '@/lib/community-options';

/** The communities someone can pick while creating their account — there is no account yet, so this
 *  is public and returns only what a person needs to recognise their own community (name, place,
 *  how many members, the usual house prefix). Nothing about who is in it. */
export async function GET(req: NextRequest) {
  const rows = await listJoinableCommunities({ q: req.nextUrl.searchParams.get('q') ?? '' });
  return NextResponse.json({
    success: true,
    data: rows.map(({ description, joined, ...open }) => open),
  });
}
