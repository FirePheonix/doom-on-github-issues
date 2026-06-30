create table if not exists public.issue_session_events (
  id bigserial primary key,
  issue_number bigint not null,
  event_type text not null,
  event_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists issue_session_events_issue_number_id_idx
  on public.issue_session_events (issue_number, id asc);
