import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { writeAudit } from '@/lib/audit';

// PATCH /api/admin/users/[id] — toggle active, change role
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getUserFromRequest(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (actor.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  const allowedUpdates: Record<string, any> = {};
  if (body.is_active !== undefined) allowedUpdates.is_active = !!body.is_active;
  if (body.role && ['user', 'admin'].includes(body.role)) allowedUpdates.role = body.role;

  if (Object.keys(allowedUpdates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(allowedUpdates)
    .eq('id', id)
    .select('id, email, role, is_active')
    .single();

  if (error || !data) return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 });

  await writeAudit({
    actor_id: actor.userId,
    actor_email: actor.email,
    action: 'user.update',
    resource_type: 'user',
    resource_id: id,
    resource_name: data.email,
    meta: allowedUpdates,
    ip_address: ip,
    success: true,
  });

  return NextResponse.json({ user: data });
}

// DELETE /api/admin/users/[id] — deactivate user
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getUserFromRequest(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (actor.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (actor.userId === id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  const { data: user } = await supabaseAdmin.from('users').select('email').eq('id', id).single();

  // Soft-delete: deactivate instead of hard delete
  const { error } = await supabaseAdmin
    .from('users')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });

  await writeAudit({
    actor_id: actor.userId,
    actor_email: actor.email,
    action: 'user.delete',
    resource_type: 'user',
    resource_id: id,
    resource_name: user?.email ?? id,
    ip_address: ip,
    success: true,
  });

  return NextResponse.json({ message: 'User deactivated' });
}
