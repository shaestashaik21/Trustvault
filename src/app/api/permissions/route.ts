import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { writeAudit } from '@/lib/audit';

// GET /api/permissions?document_id=xxx — list permissions for a document
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get('document_id');
  if (!documentId) return NextResponse.json({ error: 'document_id required' }, { status: 400 });

  // Only document owner or admin can see permissions list
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('owner_id')
    .eq('id', documentId)
    .single();

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  if (doc.owner_id !== user.userId && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('permissions')
    .select('*, user:users!user_id(id, email)')
    .eq('document_id', documentId);

  if (error) return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });

  return NextResponse.json({ permissions: data });
}

// POST /api/permissions — grant access
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  const { document_id, target_user_id, permission_level } = await req.json();

  if (!document_id || !target_user_id || !permission_level) {
    return NextResponse.json({ error: 'document_id, target_user_id, permission_level required' }, { status: 400 });
  }

  const validLevels = ['read', 'edit', 'admin'];
  if (!validLevels.includes(permission_level)) {
    return NextResponse.json({ error: `permission_level must be one of: ${validLevels.join(', ')}` }, { status: 400 });
  }

  // Only document owner or admin can grant permissions
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('owner_id, name')
    .eq('id', document_id)
    .single();

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  if (doc.owner_id !== user.userId && user.role !== 'admin') {
    await writeAudit({
      actor_id: user.userId,
      actor_email: user.email,
      action: 'permission.grant',
      resource_type: 'permission',
      resource_id: document_id,
      resource_name: doc.name,
      meta: { target_user_id, permission_level },
      ip_address: ip,
      success: false,
      failure_reason: 'Not document owner or admin',
    });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Upsert permission
  const { data, error } = await supabaseAdmin
    .from('permissions')
    .upsert({
      document_id,
      user_id: target_user_id,
      permission_level,
      granted_by: user.userId,
      granted_at: new Date().toISOString(),
    }, { onConflict: 'document_id,user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Failed to grant permission' }, { status: 500 });

  await writeAudit({
    actor_id: user.userId,
    actor_email: user.email,
    action: 'permission.grant',
    resource_type: 'permission',
    resource_id: document_id,
    resource_name: doc.name,
    meta: { target_user_id, permission_level },
    ip_address: ip,
    success: true,
  });

  return NextResponse.json({ permission: data }, { status: 201 });
}

// DELETE /api/permissions — revoke access
export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  const { document_id, target_user_id } = await req.json();
  if (!document_id || !target_user_id) {
    return NextResponse.json({ error: 'document_id and target_user_id required' }, { status: 400 });
  }

  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('owner_id, name')
    .eq('id', document_id)
    .single();

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  if (doc.owner_id !== user.userId && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('permissions')
    .delete()
    .eq('document_id', document_id)
    .eq('user_id', target_user_id);

  if (error) return NextResponse.json({ error: 'Failed to revoke permission' }, { status: 500 });

  await writeAudit({
    actor_id: user.userId,
    actor_email: user.email,
    action: 'permission.revoke',
    resource_type: 'permission',
    resource_id: document_id,
    resource_name: doc.name,
    meta: { target_user_id },
    ip_address: ip,
    success: true,
  });

  return NextResponse.json({ message: 'Permission revoked' });
}
