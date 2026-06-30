# V3 Operations

## Startup Bootstrap

```mermaid
sequenceDiagram
  participant BOOT as node src/index.js
  participant APP as createServer()
  participant RT as createRuntimeServices()
  participant DB as Session Repository
  participant SM as Session Manager

  BOOT->>APP: createServer()
  APP->>RT: build runtime services
  BOOT->>RT: prime()
  RT->>DB: listByStatus(["active"])
  DB-->>RT: active sessions
  loop each active session
    RT->>SM: restoreSession(...)
  end
  BOOT->>APP: listen(port)
```

## Runtime Health Surface

```mermaid
flowchart TD
  HEALTH[/health] --> H1[githubConfigured]
  HEALTH --> H2[runtime.repository modes]
  HEALTH --> H3[Postgres health check when enabled]
  DEBUG1[/debug/runtime] --> D1[recovery metadata]
  DEBUG1 --> D2[repositoryInfo]
  DEBUG2[/debug/issues/:id] --> D3[job timing]
  DEBUG2 --> D4[live session state]
  DEBUG2 --> D5[event count]
  DEBUG3[/debug/issues/:id/events] --> D6[append-only event log]
```

## Migration Flow

```mermaid
flowchart LR
  CLI[npm run db:migrate] --> MIG[src/migrate.js]
  MIG --> RUN[src/persistence/migrate.js]
  RUN --> SQL1[001_issue_sessions.sql]
  RUN --> SQL2[002_issue_session_events.sql]
  RUN --> PG[(Postgres)]
```

## Production Use

1. Set `DATABASE_URL`.
2. Run `npm run db:migrate`.
3. Deploy service.
4. Confirm `/health`.
5. Confirm `/debug/runtime` shows expected repository mode.
