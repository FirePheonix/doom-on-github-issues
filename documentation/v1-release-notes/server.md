# V1 Server Design

## Entry and Composition

- `src/index.js` starts Express on `PORT` (default `3000`).
- `src/server.js` wires dependencies and routes.

## Dependency Graph

```mermaid
flowchart TD
  IDX[src/index.js] --> SRV[src/server.js]
  SRV --> CFG[readRuntimeConfig]
  SRV --> GH[createGithubClient]
  SRV --> Q[createJobQueue]
  SRV --> LK[createLockStore]
  SRV --> ST[createJobStatusStore]
  SRV --> TH[createIssueThrottle]
  SRV --> R1[/health]
  SRV --> R2[/debug/issues/:id]
  SRV --> R3[/frames/:id.png]
  SRV --> R4[/webhook]
```

## Middleware

- JSON body parser with `req.rawBody` capture for GitHub HMAC verification.
- 1 MB payload limit.

## Server Responsibilities

- validate and route webhook events
- queue background jobs
- ensure renderer assets before job run
- expose frame files and basic debugging status
