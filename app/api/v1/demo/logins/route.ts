import { NextResponse } from 'next/server';
import { getDemoProtection } from '@/lib/demo/lock';
import { DEMO_PERSONAS } from '@/lib/demo/personas';

/** Public: which demo logins the sign-in page can offer. Empty until the demo is loaded.
 *  Reveals names and roles only — never an email or a password. */
export async function GET() {
  try {
    const protection = await getDemoProtection();
    if (!protection.loaded) return NextResponse.json({ success: true, data: { available: false, personas: [] } });
    return NextResponse.json({
      success: true,
      data: { available: true, personas: DEMO_PERSONAS.map(({ id, label, name, blurb, avatar }) => ({ id, label, name, blurb, avatar })) },
    });
  } catch {
    return NextResponse.json({ success: true, data: { available: false, personas: [] } });
  }
}
