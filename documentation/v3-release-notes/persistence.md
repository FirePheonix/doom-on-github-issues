# V3 Persistence Design

## Data Stores

```mermaid
flowchart LR
  LC[Session Lifecycle] --> SR[(Session Repository)]
  LC --> ER[(Session Event Repository)]
  LC --> CR[(Session Command Repository)]
  LC --> FR[(Session Frame Repository)]
  LC --> FS[(Frame Store)]
  SM[Session Manager] --> SR
  SM --> LR[(Session Lease Repository)]
  DBG[/debug/issues/:id/events] --> ER
  DBG --> CR
  DBG --> FR
  DBG --> LR
```

## Logical Model

```mermaid
erDiagram
  ISSUE_SESSIONS {
    bigint issue_number PK
    jsonb session_json
    timestamptz updated_at
  }

  ISSUE_SESSION_EVENTS {
    bigint id PK
    bigint issue_number
    text event_type
    jsonb event_json
    timestamptz created_at
  }

  ISSUE_SESSION_COMMANDS {
    bigint id PK
    bigint issue_number
    integer tick
    integer command_index
    text command_status
    text raw_command
    text accepted_command
    jsonb command_json
    timestamptz created_at
  }

  ISSUE_SESSION_LEASES {
    bigint issue_number PK
    text worker_id
    text status
    text source
    text frame_path
    integer tick
    timestamptz last_touched_at
    timestamptz lease_expires_at
    timestamptz updated_at
  }

  ISSUE_SESSION_FRAMES {
    bigint id PK
    bigint issue_number
    integer tick
    text frame_store_kind
    text frame_ref
    text public_url
    jsonb frame_json
    timestamptz published_at
  }

  ISSUE_SESSIONS ||--o{ ISSUE_SESSION_EVENTS : "issue_number"
  ISSUE_SESSIONS ||--o{ ISSUE_SESSION_COMMANDS : "issue_number"
  ISSUE_SESSIONS ||--|| ISSUE_SESSION_LEASES : "issue_number"
  ISSUE_SESSIONS ||--o{ ISSUE_SESSION_FRAMES : "issue_number"
```

## Repository Behavior

- `sessionRepository`
  - `load`
  - `loadOptional`
  - `save`
  - `exists`
  - `listByStatus`

- `sessionEventRepository`
  - `append`
  - `list`
  - `count`
- `sessionCommandRepository`
  - `append`
  - `appendMany`
  - `list`
  - `count`
- `sessionLeaseRepository`
  - `get`
  - `upsert`
  - `remove`
  - `list`
- `sessionFrameRepository`
  - `append`
  - `latest`
  - `list`
  - `count`

## Storage Modes

- `file`
  - session snapshot in `data/sessions/<issue>.json`
  - event journal in `data/events/<issue>.json`
  - command journal in `data/commands/<issue>.json`
  - live lease mirror in `data/leases/<issue>.json`
  - frame metadata in `data/frame-meta/<issue>.json`
- `postgres`
  - session row in `issue_sessions`
  - append-only rows in `issue_session_events`
  - append-only rows in `issue_session_commands`
  - upserted lease row in `issue_session_leases`
  - per-tick frame rows in `issue_session_frames`

## Frame Store Modes

- `local`
  - rendered PNG remains in `data/frames/<issue>.png`
  - issue body points to `/frames/<issue>.png?t=<tick>`
- `s3`
  - rendered PNG is uploaded to object storage after each publish
  - issue body points directly to the public object URL with tick cache-busting

## Why This Split

- `session_json` stays fast for current-state reads.
- commands, leases, and frame publishes stop bloating the snapshot row.
- operational queries move to typed columns instead of deep JSONB filters.
