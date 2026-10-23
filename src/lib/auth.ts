import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'trustvault-dev-fallback-secret-key-32chars';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Check cookie (from req.cookies or header cookie string)
  const cookieVal = req.cookies.get('trustvault_token')?.value;
  if (cookieVal) return cookieVal;

  const rawCookie = req.headers.get('cookie') || '';
  const match = rawCookie.match(/trustvault_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getUserFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Verify the caller is authenticated AND has access to the given document.
 * documentId is optional — omit to just check authentication.
 * requiredPermission: 'read' | 'edit' | 'admin'
 */
export async function verifyDocumentAccess(
  req: NextRequest,
  documentId: string,
  requiredPermission: 'read' | 'edit' | 'admin' = 'read'
): Promise<{ user: JWTPayload; allowed: boolean; reason?: string }> {
  const user = await getUserFromRequest(req);
  if (!user) return { user: null as any, allowed: false, reason: 'Not authenticated' };

  // Admins have access to everything
  if (user.role === 'admin') return { user, allowed: true };

  // Check explicit permission grant in the permissions table
  const permMap = { read: ['read', 'edit', 'admin'], edit: ['edit', 'admin'], admin: ['admin'] };
  const { data } = await supabaseAdmin
    .from('permissions')
    .select('permission_level')
    .eq('document_id', documentId)
    .eq('user_id', user.userId)
    .single();

  if (!data) return { user, allowed: false, reason: 'No permission granted' };
  if (!permMap[requiredPermission].includes(data.permission_level)) {
    return { user, allowed: false, reason: 'Insufficient permission level' };
  }

  return { user, allowed: true };
}
