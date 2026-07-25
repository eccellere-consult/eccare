import { SignJWT, jwtVerify } from 'jose';
import { hash, compare } from 'bcryptjs';
import { NextRequest } from 'next/server';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret');

export async function createToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { userId: string; role: string };
}

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, 10);
}

export async function comparePin(pin: string, hashed: string): Promise<boolean> {
  return compare(pin, hashed);
}

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.slice(7);
    return await verifyToken(token);
  } catch {
    return null;
  }
}
