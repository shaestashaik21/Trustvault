import { supabaseAdmin } from './db';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'document.upload'
  | 'document.download'
  | 'document.view'
  | 'document.delete'
  | 'document.update'
  | 'permission.grant'
  | 'permission.revoke'
  | 'user.create'
  | 'user.delete'
  | 'user.update';

export interface AuditEntry {
  actor_id: string;
  actor_email: string;
  action: AuditAction;
  resource_type: 'document' | 'permission' | 'user' | 'system';
  resource_id?: string;
  resource_name?: string;
  meta?: Record<string, unknown>;
  ip_address?: string;
  success: boolean;
  failure_reason?: string;
}

/**
 * Write an immutable audit log entry.
 * The audit table has NO update/delete RLS policy — entries are append-only.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    ...entry,
    created_at: new Date().toISOString(),
  });
  if (error) {
    // Never throw — audit failure must not break the main flow
    console.error('[AUDIT] Failed to write audit log:', error.message);
  }
}

/**
 * Get audit logs with optional filters.
 */
export async function getAuditLogs({
  page = 1,
  pageSize = 50,
  userId,
  action,
  resourceId,
  from,
  to,
}: {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: AuditAction;
  resourceId?: string;
  from?: string;
  to?: string;
}) {
  let query = supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (userId) query = query.eq('actor_id', userId);
  if (action) query = query.eq('action', action);
  if (resourceId) query = query.eq('resource_id', resourceId);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  return query;
}
