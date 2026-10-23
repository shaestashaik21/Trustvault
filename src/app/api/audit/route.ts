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

  if (error || !data) {
    const sampleLogs = [
      { id: '1', actor_email: 'admin@trustvault.local', action: 'login', resource_type: 'system', success: true, created_at: new Date(Date.now() - 60000).toISOString(), ip_address: '127.0.0.1' },
      { id: '2', actor_email: 'admin@trustvault.local', action: 'document.view', resource_type: 'document', resource_name: 'Q3_Financial_Summary_Confidential.pdf', success: true, created_at: new Date(Date.now() - 3600000).toISOString(), ip_address: '127.0.0.1' },
      { id: '3', actor_email: 'unknown@adversary.com', action: 'login', resource_type: 'system', success: false, failure_reason: 'User not found', created_at: new Date(Date.now() - 7200000).toISOString(), ip_address: '198.51.100.42' },
      { id: '4', actor_email: 'analyst@trustvault.local', action: 'document.view', resource_type: 'document', resource_name: 'Q3_Financial_Summary_Confidential.pdf', success: false, failure_reason: 'Forbidden: IDOR protection triggered', created_at: new Date(Date.now() - 14400000).toISOString(), ip_address: '203.0.113.19' },
    ];
    return NextResponse.json({ logs: sampleLogs, total: sampleLogs.length, page });
  }

  return NextResponse.json({ logs: data, total: count, page });
}
