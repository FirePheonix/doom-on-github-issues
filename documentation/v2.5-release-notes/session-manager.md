# Session Manager

## Responsibility

`src/sessions/manager.js` now owns:

- active session records by issue number
- per-session inactivity timers
- per-session runtime metadata (`lastTouchedAt`, `expiresAt`, `expiring`)
- worker start/restart/apply/stop delegation to the persistent engine
- async expiry callback into lifecycle code

## Session Record

Each in-memory record tracks:

- `issueNumber`
- `seed`
- `framePath`
- `status`
- `lastTouchedAt`
- `expiresAt`
- `expiring`

## Expiry Flow

```mermaid
sequenceDiagram
  participant SM as Session Manager
  participant Q as Job Queue
  participant L as Lock Store
  participant LC as expireIssueSession
  participant GH as GitHub API

  SM->>SM: inactivity timer fires
  SM->>Q: schedule expire job
  Q->>L: withIssueLock(issue)
  L->>LC: expireIssueSession(...)
  LC->>LC: save exited state + stop worker
  LC->>GH: update issue body + post notice
```

## Debug Endpoints

- `GET /debug/issues/:issueNumber`
- `GET /debug/sessions`
