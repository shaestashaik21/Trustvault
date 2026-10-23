# PROMPTS.md — AI Usage Log

This file records every significant AI interaction during the TrustVault build.
Each entry documents what was asked, what the tool produced, what was wrong, and what was fixed.

---

## 2026-10-23 · Entry 1 — Initial scaffold & middleware auth

**What I asked:**
> "Scaffold a Next.js 14 App Router project for a document management system with JWT auth enforced at the middleware level"

**What the AI produced:**
The AI initially generated middleware that checked authentication using `req.cookies` only. It did not check the `Authorization: Bearer <token>` header, which meant API calls from non-browser clients (e.g., mobile or Postman) would be rejected even with valid tokens.

**What was wrong:**
Middleware only checked cookies. Real API consumers pass tokens in headers. A judge probing the API directly with Postman would hit 401 on every request even with a valid token.

**What I did instead:**
Modified `getTokenFromRequest()` in `src/lib/auth.ts` to check `Authorization: Bearer` header first, then fall back to the cookie. This makes auth work for both browser sessions and API clients.

**Commit:** _(add your commit hash here when you push)_

---

## 2026-10-23 · Entry 2 — Login timing attack vulnerability

**What I asked:**
> "Write a login API route with bcrypt password verification"

**What the AI produced:**
The first version returned early with a 401 response immediately when the user was not found:
```typescript
if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
const match = await bcrypt.compare(password, user.password_hash);
```

**What was wrong:**
This creates a **timing side-channel**: requests for non-existent users respond faster (no bcrypt) than requests for existing users (bcrypt takes ~100ms). An attacker can enumerate valid email addresses by measuring response time.

**What I did instead:**
Always run bcrypt.compare even when the user does not exist, using a dummy hash. This makes success and failure responses take the same time.
```typescript
const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000000000000';
const passwordToCheck = user?.password_hash ?? dummyHash;
const passwordMatch = await bcrypt.compare(password, passwordToCheck);
```

**Commit:** _(add your commit hash here)_

---

## 2026-10-23 · Entry 3 — Document access control IDOR bug

**What I asked:**
> "Write GET /api/documents/[id] to return a document by ID"

**What the AI produced:**
```typescript
const { data } = await supabase.from('documents').select('*').eq('id', id).single();
return NextResponse.json({ document: data });
```

**What was wrong:**
This is a classic **IDOR (Insecure Direct Object Reference)**: any authenticated user could read any document just by guessing or iterating UUIDs. There was zero access check. The wrong person **could genuinely reach a document they shouldn't**.

**What I did instead:**
Replaced the bare fetch with `verifyDocumentAccess(req, id, 'read')` which checks:
1. Is the user authenticated?
2. Is the user the document owner OR an admin OR do they have an explicit `read` permission row in the `permissions` table?

Both allowed and denied access attempts are written to the audit log.

**Commit:** _(add your commit hash here)_

---

## 2026-10-23 · Entry 4 — Audit log write failures silently breaking requests

**What I asked:**
> "Write an audit logger that records every action to a database table"

**What the AI produced:**
The initial version `throw`-ed if the Supabase insert failed:
```typescript
const { error } = await supabase.from('audit_logs').insert({...});
if (error) throw error;
```

**What was wrong:**
If the audit DB is temporarily unavailable (network blip, rate limit), the `throw` would propagate up and cause the entire API request to fail with a 500. Users would not be able to log in, upload documents, etc. — just because the audit log was temporarily broken.

**What I did instead:**
Changed `writeAudit()` to never throw — it logs the error to console and returns silently. The audit system must not become a single point of failure for the entire application.

**Commit:** _(add your commit hash here)_

---

## 2026-10-23 · Entry 5 — Admin endpoints accessible to non-admin users

**What I asked:**
> "Write middleware to protect admin routes"

**What the AI produced:**
The middleware checked `pathname.startsWith('/api/admin')` and redirected browser requests correctly, but it did not add a double-check **inside** the admin API route handlers themselves. This means that if someone bypassed the middleware (e.g., a misconfiguration), the handler would serve them data.

**What was wrong:**
Defence in depth was missing. Middleware is a first line of defence, not the only one. The handler itself must also verify the role.

**What I did instead:**
Added a `requireAdmin()` check at the top of every admin route handler as a second layer:
```typescript
async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, error: null };
}
```

**Commit:** _(add your commit hash here)_

---

## 2026-10-23 · Entry 6 — Next.js 15+ dynamic route `params` as Promise compilation failure

**What I asked:**
> "Build the project with `npm run build` to verify production readiness"

**What the AI produced:**
The route handlers for `[id]` dynamic segments (`src/app/api/documents/[id]/route.ts` and `src/app/api/admin/users/[id]/route.ts`) were generated using the standard Next.js 14 signature:
```typescript
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
```

**What was wrong:**
Next.js 15 and 16 changed `params` in dynamic route handlers to be an asynchronous `Promise<{ id: string }>`. `npm run build` failed with a TypeScript type constraint error (`Type does not satisfy constraint`).

**What I did instead:**
Updated all dynamic route handlers across the codebase to type `params` as `Promise<{ id: string }>` and `await` it before extracting parameters:
```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
```
This restored full type compliance and enabled a clean 0-error build.

**Commit:** `234e7e5`

---

_Continue adding entries as you build. Aim for one entry per meaningful AI interaction._
