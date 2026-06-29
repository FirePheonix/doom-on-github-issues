# V1 Storage Design

## Local Filesystem Layout

```text
data/
  sessions/
    <issueNumber>.json
  frames/
    <issueNumber>.png
```

## Access Layer

- source: `src/storage.js`
- responsibilities:
  - ensure directories exist
  - load/save session JSON
  - resolve frame/session paths
  - session existence check

## Data Lifecycle

```mermaid
flowchart TD
  CMD[Issue command] --> UPD[Update session state in memory]
  UPD --> SAVE[Save JSON]
  SAVE --> RENDER[Render PNG]
  RENDER --> FRAME[Save frame file]
  FRAME --> VIEW[Issue body references frame URL]
```

## V1 Limitation

Storage is local to process/container and not designed for multi-instance durable production.
