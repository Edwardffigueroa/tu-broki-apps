-- Wiki · tokens Bearer MCP + auditoría
-- Aplicada remotamente como wiki_0013_mcp_tokens_audit (2026-10-12).

create table if not exists wiki.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  label text not null,
  email text not null,
  scopes text[] not null default '{read}',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count bigint not null default 0,
  constraint mcp_tokens_scopes_check check (scopes <@ array['read','write','admin']::text[])
);

create table if not exists wiki.mcp_audit (
  id bigint generated always as identity primary key,
  token_id uuid references wiki.mcp_tokens(id) on delete set null,
  tool text not null,
  page_id uuid,
  ok boolean not null,
  error_code text,
  duration_ms int,
  args_summary jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mcp_audit_created_idx on wiki.mcp_audit (created_at desc);
create index if not exists mcp_audit_token_idx on wiki.mcp_audit (token_id, created_at desc);

alter table wiki.mcp_tokens enable row level security;
alter table wiki.mcp_audit  enable row level security;
revoke all on wiki.mcp_tokens, wiki.mcp_audit from anon, authenticated;
drop policy if exists backend_total on wiki.mcp_tokens;
drop policy if exists backend_total on wiki.mcp_audit;
create policy backend_total on wiki.mcp_tokens for all to tubroki_apps using (true) with check (true);
create policy backend_total on wiki.mcp_audit  for all to tubroki_apps using (true) with check (true);
grant select, insert, update, delete on wiki.mcp_tokens, wiki.mcp_audit to tubroki_apps;
grant usage, select on all sequences in schema wiki to tubroki_apps;
grant execute on all functions in schema wiki to tubroki_apps;
