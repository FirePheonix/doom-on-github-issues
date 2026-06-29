# V1 to V2 Migration Notes

## What Changed

- Added persistent process model for rendering.
- Added `doom_session_worker.py` for live session runtime.
- Updated lifecycle to pass engine dependency and stop workers on terminal states.
- Updated command stepping return shape (`appliedCommands`, `restarted`) to support incremental render calls.
- Kept replay renderer as fallback safety path.

## Compatibility

- Existing issue/session JSON format remains valid.
- Existing webhook routes and env vars remain valid.
- `/frames/:issue.png` contract unchanged.

## Tradeoffs

- Lower per-command render latency for active sessions.
- Higher memory/process footprint (one worker per active issue).
- Worker state is process-local; server restart requires rehydration path (implemented via history prefix replay only when respawning worker).
