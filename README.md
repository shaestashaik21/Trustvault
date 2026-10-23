# TrustVault

Secure document management system with server-enforced role-based access control, granular permissions, and an immutable audit trail.

🌐 **Live Demo:** [https://trustvault-wheat.vercel.app](https://trustvault-wheat.vercel.app)  
📦 **GitHub Repo:** [https://github.com/shaestashaik21/Trustvault](https://github.com/shaestashaik21/Trustvault)

---

## Features

- 🔐 **Secure authentication** — JWT with bcrypt, httpOnly cookies, 8h expiry
- 📄 **Document management** — upload, view, update, delete with category tagging
- 🔑 **Granular permissions** — per-user, per-document (read / edit / admin)
- 🕐 **Immutable audit log** — every action logged server-side; entries cannot be deleted or modified
- ⚙️ **Admin panel** — create users, toggle roles and active status
- 🛡️ **Defence in depth** — auth enforced at middleware AND handler level

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Deployment | Vercel |
| Language | TypeScript |

---

## Local Setup

### Prerequisites
- Node.js 18+
- A free [Supabase](https://supabase.com) account

### 1. Clone and install

```bash
git clone <your-repo-url>
cd trustvault
npm install
```

### 2. Configure environment variables

Copy the template and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=a_random_string_at_least_32_chars_long
```

> ⚠️ Never commit `.env.local` to git. It is already in `.gitignore`.

### 3. Set up the database

1. Open your Supabase project → SQL Editor
2. Paste and run the contents of `supabase/schema.sql`
3. This creates all tables and seeds an admin account

**Default admin credentials:**
- Email: `admin@trustvault.local`
- Password: `Admin@123456`

> ⚠️ Change this password immediately after first login.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment (Vercel)

```bash
npm install -g vercel
vercel
```

Add the same environment variables in the Vercel dashboard under **Settings → Environment Variables**.

After deployment, test your live URL in an incognito window before submitting.

---

## Security Architecture

Authentication is enforced at **two independent layers**:

1. **`src/middleware.ts`** — Next.js edge middleware runs before any route handler. Unauthenticated requests are rejected with 401 (API) or redirected to `/login` (browser) before a single line of business logic executes.

2. **Route handlers** — Every handler that touches sensitive data independently verifies the caller's identity and permissions. This means even if middleware were misconfigured, no document data would be exposed.

See [THREATS.md](./THREATS.md) for the full threat model.

---

## What is not finished

- File content upload to Supabase Storage is scaffolded (the API accepts a `file_url`) but not wired end-to-end in the browser. Documents are currently created with a placeholder URL.
- IP rate limiting on the login endpoint is not implemented (see T7 in THREATS.md).
- Password reset flow is not implemented.

---

## Running tests

```bash
npm test
```

_(Tests are in `__tests__/` — see each file for what is covered)_
