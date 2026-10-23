import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { verifyDocumentAccess } from '@/lib/auth';

// GET /api/documents/[id] — view document metadata (access-controlled)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  const { user, allowed, reason } = await verifyDocumentAccess(req, id, 'read');

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!allowed) {
    await writeAudit({
      actor_id: user.userId,
      actor_email: user.email,
      action: 'document.view',
      resource_type: 'document',
      resource_id: id,
      ip_address: ip,
      success: false,
      failure_reason: reason,
    });
    return NextResponse.json({ error: 'Forbidden', message: reason }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*, owner:users!owner_id(id, email)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await writeAudit({
    actor_id: user.userId,
    actor_email: user.email,
    action: 'document.view',
    resource_type: 'document',
    resource_id: id,
    resource_name: data.name,
    ip_address: ip,
    success: true,
  });

  return NextResponse.json({ document: data });
}

// PATCH /api/documents/[id] — update document (owner or admin or edit permission)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  const { user, allowed, reason } = await verifyDocumentAccess(req, id, 'edit');

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed) {
    await writeAudit({
      actor_id: user.userId,
      actor_email: user.email,
      action: 'document.update',
      resource_type: 'document',
      resource_id: id,
      ip_address: ip,
      success: false,
      failure_reason: reason,
    });
    return NextResponse.json({ error: 'Forbidden', message: reason }, { status: 403 });
  }

  const body = await req.json();
  const allowedFields = ['name', 'description', 'category'];
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const f of allowedFields) {
    if (body[f] !== undefined) updates[f] = body[f];
  }

  const { data, error } = await supabaseAdmin
    .from('documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

  await writeAudit({
    actor_id: user.userId,
    actor_email: user.email,
    action: 'document.update',
    resource_type: 'document',
    resource_id: id,
    resource_name: data.name,
    meta: { changes: updates },
    ip_address: ip,
    success: true,
  });

  return NextResponse.json({ document: data });
}

// DELETE /api/documents/[id] — owner or admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch document first to verify ownership
  const { data: doc } = await supabaseAdmin.from('documents').select('*').eq('id', id).single();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = doc.owner_id === user.userId;
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    await writeAudit({
      actor_id: user.userId,
      actor_email: user.email,
      action: 'document.delete',
      resource_type: 'document',
      resource_id: id,
      resource_name: doc.name,
      ip_address: ip,
      success: false,
      failure_reason: 'Not owner or admin',
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cascade-delete permissions too
  await supabaseAdmin.from('permissions').delete().eq('document_id', id);
  const { error } = await supabaseAdmin.from('documents').delete().eq('id', id);

  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 });

  await writeAudit({
    actor_id: user.userId,
    actor_email: user.email,
    action: 'document.delete',
    resource_type: 'document',
    resource_id: id,
    resource_name: doc.name,
    ip_address: ip,
    success: true,
  });

  return NextResponse.json({ message: 'Deleted' });
}
