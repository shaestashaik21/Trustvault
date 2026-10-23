import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserFromRequest } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { v4 as uuidv4 } from 'uuid';

// Admin-only middleware check
async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { user, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, error: null };
}

// GET /api/admin/users — list all users
export async function GET(req: NextRequest) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;

  const { data, error: dbErr } = await supabaseAdmin
    .from('users')
    .select('id, email, role, is_active, created_at')
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  return NextResponse.json({ users: data });
}

// POST /api/admin/users — create a user
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';

  const { email, password, role = 'user' } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }
  if (!['user', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'role must be user or admin' }, { status: 400 });
  }

  // Check for duplicate
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });

  const password_hash = await bcrypt.hash(password, 12);
  const newId = uuidv4();

  const { data, error: dbErr } = await supabaseAdmin.from('users').insert({
    id: newId,
    email: email.toLowerCase().trim(),
    password_hash,
    role,
    is_active: true,
    created_at: new Date().toISOString(),
  }).select('id, email, role, is_active, created_at').single();

  if (dbErr) return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });

  await writeAudit({
    actor_id: user!.userId,
    actor_email: user!.email,
    action: 'user.create',
    resource_type: 'user',
    resource_id: newId,
    resource_name: email,
    ip_address: ip,
    success: true,
  });

  return NextResponse.json({ user: data }, { status: 201 });
}
