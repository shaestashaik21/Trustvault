import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getAuditLogs } from '@/lib/audit';

// GET /api/audit — admin gets all logs; users get only their own
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const action = searchParams.get('action') as any;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const resourceId = searchParams.get('resource_id') ?? undefined;

  // Non-admins can only see their own audit trail
  const userId = user.role === 'admin'
    ? (searchParams.get('user_id') ?? undefined)
    : user.userId;

  const { data, error, count } = await getAuditLogs({ page, userId, action, resourceId, from, to });

  if (error) return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });

  return NextResponse.json({ logs: data, total: count, page });
}
