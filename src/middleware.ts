import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';

// Routes that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Enforce auth on everything else
  const token = getTokenFromRequest(req);
  const user = token ? verifyToken(token) : null;

  if (!user) {
    // API calls → 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid token required' },
        { status: 401 }
      );
    }
    // Page requests → redirect to login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  const ADMIN_PATHS = ['/api/admin', '/admin'];
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
