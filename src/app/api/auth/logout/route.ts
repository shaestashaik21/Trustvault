import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  if (user) {
    await writeAudit({
      actor_id: user.userId,
      actor_email: user.email,
      action: 'logout',
      resource_type: 'system',
      ip_address: ip,
      success: true,
    });
  }

  const res = NextResponse.json({ message: 'Logged out' });
  res.cookies.set('trustvault_token', '', { maxAge: 0, path: '/' });
  return res;
}
