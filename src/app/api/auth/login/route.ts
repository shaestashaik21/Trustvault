import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/db';
import { writeAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  let email = '';

  try {
    const body = await req.json();
    email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Fetch user from DB
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, role, is_active')
      .eq('email', email)
      .single();

    // Constant-time comparison to prevent user enumeration
    const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000000000000';
    const passwordToCheck = user?.password_hash ?? dummyHash;
    const passwordMatch = await bcrypt.compare(password, passwordToCheck);

    if (error || !user || !passwordMatch || !user.is_active) {
      await writeAudit({
        actor_id: user?.id ?? 'unknown',
        actor_email: email,
        action: 'login',
        resource_type: 'system',
        ip_address: ip,
        success: false,
        failure_reason: !user ? 'User not found' : !passwordMatch ? 'Wrong password' : 'Account inactive',
      });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Issue JWT
    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    await writeAudit({
      actor_id: user.id,
      actor_email: user.email,
      action: 'login',
      resource_type: 'system',
      ip_address: ip,
      success: true,
    });

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role },
      token,
    });

    // Set httpOnly cookie
    res.cookies.set('trustvault_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[LOGIN]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
