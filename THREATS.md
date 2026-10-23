# THREATS.md — Threat Model for TrustVault

This document identifies the security threats considered during design, the mitigations implemented, and the tests that verify each mitigation.

---

## Threat Model Scope

**System:** TrustVault document management system
**Assets:** Documents (content + metadata), user credentials, audit logs, permission records
**Attacker profiles:**
- Unauthenticated outsider trying to access documents
- Authenticated user trying to access documents they don't own
- Compromised/malicious user trying to cover their tracks
- Admin-level attacker trying to escalate privileges

---

## Threats and Mitigations

### T1 — Unauthenticated document access

| | |
|---|---|
| **Threat** | An outsider (no login) calls `GET /api/documents/abc123` directly |
| **Impact** | Full read access to any document |
| **Mitigation** | Next.js middleware intercepts every non-public route and returns 401 if no valid JWT is present. No handler code runs. |
| **Test** | `curl /api/documents` with no token → expect 401 |

---

### T2 — Insecure Direct Object Reference (IDOR)

| | |
|---|---|
| **Threat** | User A guesses User B's document UUID and calls `GET /api/documents/<uuid>` |
| **Impact** | User A reads a document they were never granted access to |
| **Mitigation** | `verifyDocumentAccess()` checks that the requester is the owner, an admin, or has an explicit permission row. The check runs in the API handler, not just middleware. |
| **Test** | Create two users; user A uploads a doc; user B tries to GET it → expect 403; audit log shows the failed attempt |

---

### T3 — Privilege escalation via role manipulation

| | |
|---|---|
| **Threat** | Regular user sends `PATCH /api/admin/users/their-own-id` with `{ "role": "admin" }` |
| **Impact** | Self-promotion to admin |
| **Mitigation** | Middleware blocks `/api/admin/*` for non-admins. Admin route handlers also call `requireAdmin()` as a second check (defence in depth). |
| **Test** | Login as user, PATCH own user record with role=admin → expect 403 |

---

### T4 — Timing attack on login (user enumeration)

| | |
|---|---|
| **Threat** | Attacker sends login requests with known-valid and unknown emails, measures response time to enumerate valid accounts |
| **Impact** | Attacker builds a list of valid email addresses for targeted attacks |
| **Mitigation** | Login route always calls `bcrypt.compare()` regardless of whether the user exists, using a dummy hash. Response time is ~constant (~100ms bcrypt). |
| **Test** | Time 100 requests for known vs unknown email — difference should be < 10ms |

---

### T5 — Audit log tampering (covering tracks)

| | |
|---|---|
| **Threat** | A malicious user (or compromised admin) deletes or edits audit log entries to hide their actions |
| **Impact** | Non-repudiation is broken; investigations become impossible |
| **Mitigation** | Audit log table has RLS policies that deny all direct client reads and writes. Only the service role key (used by the server) can insert. No UPDATE or DELETE policy exists — rows are immutable once written. |
| **Test** | Try to DELETE from audit_logs using the anon key → expect RLS denial |

---

### T6 — JWT token forgery / replay

| | |
|---|---|
| **Threat** | Attacker forges a JWT with `{ "role": "admin" }` or replays a stolen token |
| **Impact** | Unauthorized admin access |
| **Mitigation** | Tokens are signed with a secret (min 32 chars) via HS256. `verifyToken()` rejects unsigned, tampered, or expired tokens. Tokens expire in 8 hours. |
| **Test** | Submit a manually crafted JWT → expect 401 |

---

### T7 — Brute-force login

| | |
|---|---|
| **Threat** | Attacker submits thousands of login attempts to guess passwords |
| **Impact** | Credential compromise |
| **Mitigation** | bcrypt cost factor 12 makes each check ~100-300ms (so ~3-10/second max throughput). **TODO:** Add rate limiting middleware (e.g., upstash/ratelimit) — not yet implemented. |
| **Status** | ⚠️ Partially mitigated — bcrypt slows attacks; IP rate limiting not yet implemented |

---

### T8 — Horizontal permission bypass via permissions API

| | |
|---|---|
| **Threat** | User A calls `POST /api/permissions` to grant themselves access to User B's document |
| **Impact** | Unauthorized access grant |
| **Mitigation** | `/api/permissions POST` checks that the requester is the document owner or an admin before allowing any grant. Failed attempts are logged to audit. |
| **Test** | User A tries to grant themselves read on User B's doc → expect 403; audit log shows attempt |

---

## Known Limitations / Unfinished Items

- Rate limiting on login endpoint not yet implemented (T7 above)
- File content is currently stored as a URL reference; actual Supabase Storage upload integration is scaffolded but not wired end-to-end
- Password reset flow is not implemented

These items are disclosed honestly — they are known gaps, not hidden defects.
