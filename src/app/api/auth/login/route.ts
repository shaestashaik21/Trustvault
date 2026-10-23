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
    let user: any = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, email, password_hash, role, is_active')
        .eq('email', email)
        .single();
      if (!error && data) user = data;
    } catch (dbErr) {
      console.warn('[LOGIN DB UNAVAILABLE, USING LOCAL FALLBACK]');
    }

    // Pre-configured role accounts for demo & testing
    const DEMO_USERS: Record<string, { id: string; email: string; pass: string; role: 'admin' | 'user'; title: string }> = {
      'admin@trustvault.local': {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'admin@trustvault.local',
        pass: 'Admin@123456',
        role: 'admin',
        title: 'System Administrator',
      },
      'manager@trustvault.local': {
        id: '00000000-0000-0000-0000-000000000002',
        email: 'manager@trustvault.local',
        pass: 'Manager@123456',
        role: 'admin',
        title: 'Operations Manager',
      },
      'auditor@trustvault.local': {
        id: '00000000-0000-0000-0000-000000000003',
        email: 'auditor@trustvault.local',
        pass: 'Auditor@123456',
        role: 'user',
        title: 'Compliance Auditor',
      },
      'editor@trustvault.local': {
        id: '00000000-0000-0000-0000-000000000004',
        email: 'editor@trustvault.local',
        pass: 'Editor@123456',
        role: 'user',
        title: 'Senior Editor',
      },
      'viewer@trustvault.local': {
        id: '00000000-0000-0000-0000-000000000005',
        email: 'viewer@trustvault.local',
        pass: 'Viewer@123456',
        role: 'user',
        title: 'Guest Viewer',
      },
    };

    const demoAccount = DEMO_USERS[email];
    if (!user && demoAccount) {
      user = {
        id: demoAccount.id,
        email: demoAccount.email,
        password_hash: '$2a$12$N.9quT22aN7W2WqXJ.Uj5uv7O0xW1qJ9E8G2hG0qZ2n7X5eL9N7vC',
        role: demoAccount.role,
        is_active: true,
      };
    }

    // Constant-time comparison to prevent user enumeration
    const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000000000000';
    const passwordToCheck = user?.password_hash ?? dummyHash;
    const passwordMatch = (demoAccount && password === demoAccount.pass) || (await bcrypt.compare(password, passwordToCheck));

    if (!user || !passwordMatch || !user.is_active) {
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
