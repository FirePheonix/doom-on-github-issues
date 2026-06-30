create table if not exists public.issue_sessions (
  issue_number bigint primary key,
  session_json jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists issue_sessions_updated_at_idx
  on public.issue_sessions (updated_at desc);
