create table if not exists public.issue_session_commands (
  id bigserial primary key,
  issue_number bigint not null,
  tick integer,
  command_index integer not null default 0,
  command_status text not null,
  raw_command text,
  accepted_command text,
  command_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists issue_session_commands_issue_number_id_idx
  on public.issue_session_commands (issue_number, id asc);

create index if not exists issue_session_commands_issue_number_tick_idx
  on public.issue_session_commands (issue_number, tick asc);

create table if not exists public.issue_session_leases (
  issue_number bigint primary key,
  worker_id text not null,
  status text not null,
  source text not null,
  frame_path text,
  tick integer,
  last_touched_at timestamptz,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists issue_session_leases_status_updated_at_idx
  on public.issue_session_leases (status, updated_at desc);

create table if not exists public.issue_session_frames (
  id bigserial primary key,
  issue_number bigint not null,
  tick integer not null,
  frame_store_kind text not null,
  frame_ref text not null,
  public_url text,
  frame_json jsonb not null,
  published_at timestamptz not null default now(),
  unique (issue_number, tick)
);

create index if not exists issue_session_frames_issue_number_tick_idx
  on public.issue_session_frames (issue_number, tick desc);
