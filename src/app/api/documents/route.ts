import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';

// GET /api/documents — list documents accessible to current user
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = 20;

  try {
    let query;

    if (user.role === 'admin') {
      // Admins see all documents
      query = supabaseAdmin
        .from('documents')
        .select('*, owner:users!owner_id(email, id)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
    } else {
      // Regular users see only documents they own OR have explicit permission on
      const { data: permittedIds } = await supabaseAdmin
        .from('permissions')
        .select('document_id')
        .eq('user_id', user.userId);

      const ids = (permittedIds ?? []).map((p: any) => p.document_id);

      query = supabaseAdmin
        .from('documents')
        .select('*, owner:users!owner_id(email, id)', { count: 'exact' })
        .or(`owner_id.eq.${user.userId},id.in.(${ids.length ? ids.join(',') : 'null'})`)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
    }

    if (category) query = (query as any).eq('category', category);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ documents: data, total: count, page, pageSize });
  } catch (err: any) {
    console.error('[DOCS GET]', err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// POST /api/documents — create a document record (metadata only; file stored in Supabase Storage)
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  try {
    const body = await req.json();
    const { name, description, category, file_url, file_size, file_type } = body;

    if (!name || !file_url) {
      return NextResponse.json({ error: 'name and file_url are required' }, { status: 400 });
    }

    const docId = uuidv4();
    const { data, error } = await supabaseAdmin.from('documents').insert({
      id: docId,
      name,
      description: description ?? '',
      category: category ?? 'General',
      file_url,
      file_size: file_size ?? 0,
      file_type: file_type ?? 'application/octet-stream',
      owner_id: user.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    await writeAudit({
      actor_id: user.userId,
      actor_email: user.email,
      action: 'document.upload',
      resource_type: 'document',
      resource_id: docId,
      resource_name: name,
      ip_address: ip,
      success: true,
    });

    return NextResponse.json({ document: data }, { status: 201 });
  } catch (err: any) {
    console.error('[DOCS POST]', err);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}
