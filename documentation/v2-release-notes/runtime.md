# V2 Runtime Components

## Node Side

- `src/engine.js`
  - new persistent engine pool
  - manages one Python worker process per issue
  - API: `startSession`, `applyCommands`, `restartSession`, `stopSession`, `invalidate`

- `src/sessions/artifacts.js`
  - saves session JSON
  - uses persistent engine for start/step/restart
  - fallback to legacy replay renderer if persistent path errors

- `src/sessions/lifecycle.js`
  - threads engine through start/apply/close
  - stops worker on close/inactivity/exit states

## Python Side

- `scripts/doom_session_worker.py`
  - long-lived stdin/stdout JSON protocol
  - keeps a live ViZDoom game instance
  - commands:
    - `snapshot`
    - `step` with command list
    - `shutdown`

## Protocol

```mermaid
sequenceDiagram
  participant N as Node Engine Pool
  participant P as doom_session_worker.py
  N->>P: {"id":1,"type":"snapshot"}
  P-->>N: {"id":1,"ok":true}
  N->>P: {"id":2,"type":"step","commands":["w","w","fire"]}
  P-->>N: {"id":2,"ok":true}
  N->>P: {"id":3,"type":"shutdown"}
  P-->>N: {"id":3,"ok":true}
```
