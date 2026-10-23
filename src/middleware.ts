import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

// Routes that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
  '/custom-bg.png',
  '/cosmic-bg.png',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files (.png, .jpg, .svg, .ico, etc) and public paths
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  // Check token in cookie or authorization header
  const token = req.cookies.get('trustvault_token')?.value || req.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Valid token required' }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Parse JWT payload safely in edge environment without Node.js crypto crash
  let user: any = null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      user = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    }
  } catch {
    user = null;
  }

  if (!user || (user.exp && Date.now() >= user.exp * 1000)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes (API and Page routes)
  const ADMIN_PATHS = ['/api/admin', '/dashboard/admin', '/dashboard/audit'];
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && user.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden', message: 'Admin only' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Inject user info into headers for API routes
  const res = NextResponse.next();
  res.headers.set('x-user-id', user.userId);
  res.headers.set('x-user-email', user.email);
  res.headers.set('x-user-role', user.role);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
