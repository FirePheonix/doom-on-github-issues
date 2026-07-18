# Persistent DoomGeneric Design

## Why Persistence Matters

Replay rendering gets slower as history grows because each later frame replays more commands from the beginning of the session. A live DoomGeneric worker keeps the game state in memory, so a new comment applies only the new command batch.

```mermaid
flowchart TD
  A["Replay Mode"] --> B["Load session history"]
  B --> C["Replay commands from tick 0"]
  C --> D["Capture final frame"]
  D --> E["Cost grows with history length"]

  F["Persistent Mode"] --> G["Reuse live DoomGeneric process"]
  G --> H["Apply only new commands"]
  H --> I["Capture final frame"]
  I --> J["Cost follows command batch size"]
```

## Native Worker Protocol

```mermaid
stateDiagram-v2
  [*] --> Starting
  Starting --> Ready: READY
  Ready --> Stepping: STEP commands
  Stepping --> Ready: OK after capture
  Ready --> Snapshotting: SNAPSHOT
  Snapshotting --> Ready: OK
  Ready --> Stopped: SHUTDOWN
  Starting --> Failed: timeout / exit
  Stepping --> Failed: timeout / exit
```

## C Worker Loop

V4 changed the native worker to match the DoomGeneric port model:

```mermaid
flowchart TD
  START["main"] --> CREATE["doomgeneric_Create"]
  CREATE --> READY["print READY"]
  READY --> LOOP{"running"}
  LOOP --> POLL["poll stdin"]
  POLL -->|STEP| SCHED["schedule key events"]
  POLL -->|SNAPSHOT| SNAP["write PPM immediately"]
  POLL -->|SHUTDOWN| STOP["exit"]
  SCHED --> TICK["doomgeneric_Tick"]
  POLL --> TICK
  TICK --> DRAW["DG_DrawFrame"]
  DRAW --> CAP{"capture tick reached?"}
  CAP -->|yes| WRITE["write PPM + OK"]
  CAP -->|no| LOOP
  WRITE --> LOOP
```

## Python Bridge

The Python worker owns three jobs:

- spawn the native DoomGeneric worker
- translate Node JSON messages into native text protocol messages
- convert the native PPM output into the PNG expected by the rest of the app

```mermaid
flowchart LR
  NODE["Node engine.js"] -->|JSON step| PY["doom_session_worker.py"]
  PY -->|STEP w d fire| C["doomgeneric_session_worker"]
  C -->|PPM| PY
  PY -->|PNG| FRAME["data/frames/{issue}.png"]
  PY -->|JSON ok| NODE
```

## Startup Output Handling

DoomGeneric can print normal startup text to stdout before protocol messages. V4 treats only these as protocol:

- `READY`
- `OK...`
- `ERR...`

Other stdout lines are logged to stderr as `doomgeneric_session_stdout=...` and ignored by the protocol parser.

## Timeout Split

```mermaid
flowchart LR
  USER["Visible Comment Path"] --> SHORT["4s startup/sync wait"]
  SHORT --> FALLBACK["Replay fallback if not ready"]

  BG["Hidden Background Priming"] --> LONG["30s worker bootstrap"]
  LONG --> HOT["Live worker ready for later comments"]
```

This avoids bringing back minute-long user stalls while still allowing the hidden native worker enough time to boot.
