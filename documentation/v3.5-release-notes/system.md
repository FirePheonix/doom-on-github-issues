# V3.5 System Design

## Cached Boot Frame Flow

```mermaid
flowchart LR
  GH[GitHub Issues] --> WH[/webhook]
  WH --> BFC[Boot Frame Cache]
  WH --> IV[Loading View Update]
  WH --> Q[Async Job Queue]
  BFC --> FS[Frame Store]
  FS --> GH
  Q --> SM[Session Manager]
  SM --> DW[Persistent Doom Worker]
  DW --> FS
```

## Components

- `src/bootFrame/cache.js`
  - generates and caches a reusable boot frame
  - publishes an issue-specific boot image immediately on `issues.opened`
- `src/routes/webhook.js`
  - sends loading view with a unique boot-frame cache token
  - schedules real session startup afterward
- `src/routes/frames.js`
  - falls back to the cached boot frame if an issue frame is not ready yet
- `src/runtime.js`
  - optionally prewarms the cached boot frame during startup

## Why It Helps

- removes blank-image time on new issues
- keeps the live Doom process path unchanged
- avoids cache collision with the real first frame by using a distinct boot token
