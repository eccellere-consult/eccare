import { NextResponse } from 'next/server';
import { getPricingContent } from '@/lib/pricing-content';

/** Public, unauthenticated — feeds the /pricing page. Returns the content
 *  regardless of isVisible; the page itself decides whether to render the
 *  soft-off notice or the real content, so the visibility check lives in
 *  exactly one place. */
export async function GET() {
  const content = await getPricingContent();
  return NextResponse.json({ success: true, data: content });
}
