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
  HEALTH["/health"] --> H1["githubConfigured"]
  HEALTH --> H2["runtime.repository modes"]
  HEALTH --> H3["Postgres health checks for session and operational repos"]
  HEALTH --> H4["S3 bucket health check when enabled"]
  DEBUG1["/debug/runtime"] --> D1["recovery metadata"]
  DEBUG1 --> D2["repositoryInfo + workerId"]
  DEBUG2["/debug/issues/:id"] --> D3["job timing"]
  DEBUG2 --> D4["live session state"]
  DEBUG2 --> D5["event count + command count + frame count + lease"]
  DEBUG3["/debug/issues/:id/events"] --> D6["append-only event log"]
  DEBUG4["/debug/issues/:id/commands"] --> D7["command journal"]
  DEBUG5["/debug/issues/:id/frames"] --> D8["published frame metadata"]
  DEBUG6["/debug/leases"] --> D9["active lease view"]
```

## Command Execution Persistence

```mermaid
sequenceDiagram
  participant GH as GitHub Comment
  participant WH as /webhook
  participant LC as applyIssueCommentCommand()
  participant CR as Session Command Repo
  participant SM as Session Manager
  participant FS as Frame Store
  participant FR as Session Frame Repo

  GH->>WH: issue_comment.created
  WH->>LC: queued command
  LC->>CR: append / appendMany
  LC->>SM: applyCommands(...)
  SM-->>LC: updated live frame
  LC->>FS: publish frame
  LC->>FR: append frame metadata
```

## Migration Flow

```mermaid
flowchart LR
  CLI[npm run db:migrate] --> MIG[src/migrate.js]
  MIG --> RUN[src/persistence/migrate.js]
  RUN --> SQL1[001_issue_sessions.sql]
  RUN --> SQL2[002_issue_session_events.sql]
  RUN --> SQL3[003_issue_session_operations.sql]
  RUN --> PG[(Postgres)]
```

## Production Use

1. Set `DATABASE_URL`.
2. Set `FRAME_S3_BUCKET`, `FRAME_S3_REGION`, `FRAME_S3_PUBLIC_BASE_URL`, and AWS credentials.
3. Run `npm run db:migrate`.
4. Deploy service.
5. Confirm `/health`.
6. Confirm `/debug/runtime` shows expected repository mode.
7. Confirm `/debug/leases` and `/debug/issues/:id/commands` are being populated after live traffic.
