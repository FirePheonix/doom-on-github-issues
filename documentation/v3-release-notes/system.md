# V3 System Design

V3 adds two production-leaning capabilities on top of `v2.5`:

- append-only session event journaling
- runtime recovery of active sessions on boot

## End-to-End System

```mermaid
flowchart LR
  U[GitHub User] --> GH[GitHub Issues]
  GH -->|issues / issue_comment webhook| API[Express API]
  API --> Q[In-Process Job Queue]
  Q --> L[Per-Issue Lock]
  L --> LC[Session Lifecycle]
  LC --> SR[(Session Repository)]
  LC --> ER[(Session Event Repository)]
  LC --> FS[(Frame Store)]
  LC --> SM[Session Manager]
  SM --> ENG[Persistent Engine]
  ENG --> W[Per-Issue Doom Worker]
  W --> F[(Local Frame PNG)]
  FS --> PUB[Public Frame URL]
  LC --> GHU[GitHub Issue Update / Comment]
  GHU --> GH
```

## Runtime Components

```mermaid
flowchart TD
  IDX[src/index.js]
  IDX --> APP[src/server.js]
  APP --> RT[src/runtime.js]
  RT --> CFG[env config]
  RT --> JOBS[job queue / lock store / status store]
  RT --> SR[session repository]
  RT --> ER[event repository]
  RT --> SM[session manager]
  SM --> ENG[engine]
  APP --> ROUTES[routes/*]
  ROUTES --> LIFE[sessions/lifecycle.js]
  LIFE --> VIEW[views/gameView.js]
```

## V3 Outcomes

- every material session transition can now be replayed from the event journal
- boot-time recovery restores active sessions into the manager and re-arms inactivity timers
- frame publication is abstracted behind a local-or-S3 frame store
- debug surfaces can inspect queue timing, live session state, and event history together
