# V3 Persistence Design

## Data Stores

```mermaid
flowchart LR
  LC[Session Lifecycle] --> SR[(Session Repository)]
  LC --> ER[(Session Event Repository)]
  LC --> FS[(Frame Store)]
  SM[Session Manager] --> SR
  DBG[/debug/issues/:id/events] --> ER
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

  ISSUE_SESSIONS ||--o{ ISSUE_SESSION_EVENTS : "issue_number"
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

## Storage Modes

- `file`
  - session snapshot in `data/sessions/<issue>.json`
  - event journal in `data/events/<issue>.json`
- `postgres`
  - session row in `issue_sessions`
  - append-only rows in `issue_session_events`

## Frame Store Modes

- `local`
  - rendered PNG remains in `data/frames/<issue>.png`
  - issue body points to `/frames/<issue>.png?t=<tick>`
- `s3`
  - rendered PNG is uploaded to object storage after each publish
  - issue body points directly to the public object URL with tick cache-busting
