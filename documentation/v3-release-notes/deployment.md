# V3 Deployment

## Current Runtime Topology

```mermaid
flowchart LR
  GH[GitHub] <--> APP[Single App Instance]
  APP --> FS[(Local data/)]
  APP --> PY[Python / DoomGeneric runtime]
```

## Recommended Production Topology

```mermaid
flowchart LR
  GH[GitHub] --> API[Stateless API instances]
  API --> DB[(Postgres)]
  API --> OBJ[(Object Storage)]
  API --> WRK[Render / Session workers]
  WRK --> DB
  WRK --> OBJ
  WRK --> DG[DoomGeneric / ViZDoom processes]
  OPS[Operators] --> API
  OPS --> DB
```

## Operational Surface in V3

- `GET /health`
- `GET /debug/issues/:issueNumber`
- `GET /debug/issues/:issueNumber/events`
- `GET /debug/sessions`
- `GET /debug/runtime`

## Remaining Gaps After V3

- queue is still in-process
- timers are still in-process
- object storage is not yet implemented
- Postgres adapters are scaffolded, not the default runtime path
