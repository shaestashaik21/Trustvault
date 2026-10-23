-- ============================================================
-- TrustVault Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- USERS TABLE
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  password_hash text not null,
  role        text not null default 'user' check (role in ('user', 'admin')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- DOCUMENTS TABLE
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text default '',
  category    text default 'General',
  file_url    text not null,
  file_size   bigint default 0,
  file_type   text default 'application/octet-stream',
  owner_id    uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- PERMISSIONS TABLE
create table if not exists public.permissions (
  id               uuid primary key default gen_random_uuid(),
  document_id      uuid not null references public.documents(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  permission_level text not null check (permission_level in ('read', 'edit', 'admin')),
  granted_by       uuid references public.users(id),
  granted_at       timestamptz not null default now(),
  unique(document_id, user_id)
);

-- AUDIT LOGS TABLE (append-only — no UPDATE policy)
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid,
  actor_email     text,
  action          text not null,
  resource_type   text not null,
  resource_id     uuid,
  resource_name   text,
  meta            jsonb,
  ip_address      text,
  success         boolean not null default true,
  failure_reason  text,
  created_at      timestamptz not null default now()
);

-- INDEXES for performance
create index if not exists idx_documents_owner on public.documents(owner_id);
create index if not exists idx_permissions_user on public.permissions(user_id);
create index if not exists idx_permissions_document on public.permissions(document_id);
create index if not exists idx_audit_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);
create index if not exists idx_audit_resource on public.audit_logs(resource_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- We use the service role key in API routes so these RLS policies
-- apply only to anon/browser clients as an extra defence layer.
-- ============================================================

alter table public.users enable row level security;
alter table public.documents enable row level security;
alter table public.permissions enable row level security;
alter table public.audit_logs enable row level security;

-- audit_logs: no direct client access
create policy "No direct client reads on audit" on public.audit_logs
  for select using (false);
create policy "No direct client writes on audit" on public.audit_logs
  for insert with check (false);

-- ============================================================
-- SEED: default admin account (change password immediately!)
-- Password: Admin@123456 (bcrypt hash below)
-- ============================================================
insert into public.users (id, email, password_hash, role, is_active)
values (
  gen_random_uuid(),
  'admin@trustvault.local',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGqTG7R4xKGKjA1ZJhNtFKvnNGW',
  'admin',
  true
)
on conflict (email) do nothing;
