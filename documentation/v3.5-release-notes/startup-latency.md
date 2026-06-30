# V3.5 Startup Latency

## Issue Open Sequence

```mermaid
sequenceDiagram
  participant GH as GitHub
  participant WH as /webhook
  participant BFC as Boot Frame Cache
  participant FS as Frame Store
  participant IV as Issue Loading View
  participant Q as Job Queue
  participant SM as Session Manager
  participant DW as Doom Worker
  participant GV as Issue Game View

  GH->>WH: issues.opened
  WH->>BFC: ensure cached boot frame
  BFC-->>WH: cached PNG path
  WH->>FS: publish issue-specific boot frame
  WH->>IV: update issue body with boot image URL (?t=boot-...)
  WH->>Q: schedule session start
  Q->>SM: startSession()
  SM->>DW: boot live Doom process
  DW->>FS: publish real first frame
  SM->>GV: update issue body with live frame URL (?t=0)
```

## Startup Prewarm

```mermaid
sequenceDiagram
  participant BOOT as App Startup
  participant RT as Runtime Prime
  participant BFC as Boot Frame Cache
  participant ENG as Engine Assets + Renderer

  BOOT->>RT: prime()
  RT->>BFC: prewarm when enabled
  BFC->>ENG: ensure assets and render cached frame once
  ENG-->>BFC: boot-frame.png
  BFC-->>RT: cached frame ready
```

## Operational Notes

- `DOOM_BOOT_FRAME_CACHE=true`
  - enables the feature
- `DOOM_BOOT_FRAME_PREWARM=true`
  - avoids first-traffic boot-frame generation cost
- the cached frame improves perceived speed
- the real frame still depends on worker boot, render, publish, and GitHub update latency
