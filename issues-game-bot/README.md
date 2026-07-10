# Issues Doom Bot

Turn-based Doom sessions driven by GitHub Issues/comments, rendered through a DoomGeneric-first engine pipeline with ViZDoom fallback.

## How it works
- New issue opens a new session (`issue_number` == session ID).
- Every new comment is one input action.
- Node webhook handler stores session state/history.
- Session manager owns one live runtime per active issue and enforces inactivity expiry.
- Python worker pipeline uses a persistent Doom session worker first, with replay fallback when needed.
- A cached boot frame is published immediately on issue open so users see an image before the live session finishes booting.
- Issue body embeds `/frames/<issue>.png` so each action updates graphics.

## Code layout
- `src/server.js`: app composition and dependency wiring only.
- `src/runtime.js`: runtime service composition for server boot and smoke tests.
- `src/persistence/`: session snapshot, event journal, command journal, lease, and frame metadata adapters.
- `src/frameStore/`: frame publishing adapters (`local` default, `s3` when configured).
- `src/routes/`: HTTP endpoints (`/webhook`, `/frames`, `/health`, `/debug`).
- `src/github/`: GitHub client, webhook validation, issue update/comment helpers.
- `src/jobs/`: async webhook job queue, per-issue locks, debug status.
- `src/sessions/`: command normalization, lifecycle, inactivity, session manager, persistence artifacts.
- `src/views/`: GitHub issue markdown rendering for loading/game screens.
- `src/renderer/`: frame URL/render-adapter helpers.
- `scripts/`: Python/C Doom renderer pipeline.
- `sql/`: Postgres schema scaffolds for snapshots, events, commands, leases, and frames.

## Commands
- `w`: move forward
- `s`: move backward
- `a`: turn left
- `d`: turn right
- `left/right/up/down`: aliases for `a/d/w/s`
- `fire`: attack
- `shoot`: alias for `fire`
- `enter`: menu/select
- `esc`: menu back
- `exit` / `quit`: exit the game session without closing the GitHub issue
- Add a repeat count for stronger input, for example `right 6` or `fire 5`
- `restart`
- `help`

## Local setup
1. Install Node deps:
```bash
npm install
```
2. Install Python deps:
```bash
pip install -r requirements.txt
python scripts/fetch_doom_assets.py
```
3. Configure env from `.env.example`.
4. Run server:
```bash
npm start
```
5. Run local smoke checks:
```bash
npm run render:smoke
npm run e2e:smoke
npm run frame-store:smoke
npm run recovery:smoke
npm run repository-mode:smoke
```
6. If using Postgres, run migrations:
```bash
npm run db:migrate
```

## Supabase setup

You can use Supabase as the managed database layer for this app without changing the runtime code.

Recommended shape:
- Supabase for `DATABASE_URL`
- current S3 bucket for frame PNGs
- no data deletion during the switch

Steps:
1. Create a Supabase project.
2. In Supabase, copy a Postgres connection string from **Connect**.
3. Put it in:
   - `DATABASE_URL=postgres://...`
4. Keep your existing S3 env:
   - `AWS_ACCESS_KEY_ID=...`
   - `AWS_SECRET_ACCESS_KEY=...`
   - `AWS_REGION=...`
   - `S3_BUCKET_NAME=...`
   - `S3_FOLDER_NAME=...`
5. Run:
```bash
npm run db:migrate
```

Notes:
- For persistent app servers, use a direct or session-pooled Supabase connection string.
- The app still uses the existing `pg` driver and repository layer; Supabase is treated as managed Postgres.
- Frame PNGs can stay on S3. You do not need to move them to Supabase Storage to use Supabase for the database.

## Session persistence

- Default repository mode:
  - `postgres` when `DATABASE_URL` is present
  - otherwise `file`
- Example env file: `.env.example`
- Env:
  - `SESSION_REPOSITORY=file|postgres`
  - `DATABASE_URL=...` when using Postgres
  - `SESSION_REPOSITORY_SCHEMA=public`
  - `SESSION_REPOSITORY_TABLE=issue_sessions`
- Initial schema file: `sql/001_issue_sessions.sql`

## Frame storage

- Default frame store mode:
  - `s3` when `S3_BUCKET_NAME` is present
  - otherwise `local`
- Env:
  - `FRAME_STORE=local|s3`
  - `S3_BUCKET_NAME=...`
  - `S3_FOLDER_NAME=frames`
  - `AWS_REGION=us-east-1`
  - `AWS_ACCESS_KEY_ID=...`
  - `AWS_SECRET_ACCESS_KEY=...`
  - `AWS_SESSION_TOKEN=...` optional
  - public frame URL is inferred from bucket + region by default
  - legacy aliases still supported:
    - `AWS_S3_BUCKET=...`
    - `AWS_S3_PREFIX=...`
    - `FRAME_S3_BUCKET=...`
    - `FRAME_S3_PREFIX=...`
    - `FRAME_S3_PUBLIC_BASE_URL=https://...`
    - `FRAME_CDN_BASE_URL=https://...`
  - `FRAME_S3_ENDPOINT=https://...` for S3-compatible stores
  - `FRAME_S3_FORCE_PATH_STYLE=true|false`

## Session event journal

- Default event repository mode follows session repository mode unless explicitly overridden
- Env:
  - `SESSION_EVENT_REPOSITORY=file|postgres`
  - `SESSION_EVENT_REPOSITORY_SCHEMA=public`
  - `SESSION_EVENT_REPOSITORY_TABLE=issue_session_events`
- Initial schema file: `sql/002_issue_session_events.sql`

## Operational persistence

- Command journal:
  - `SESSION_COMMAND_REPOSITORY=file|postgres`
  - `SESSION_COMMAND_REPOSITORY_SCHEMA=public`
  - `SESSION_COMMAND_REPOSITORY_TABLE=issue_session_commands`
- Session leases:
  - `SESSION_LEASE_REPOSITORY=file|postgres`
  - `SESSION_LEASE_REPOSITORY_SCHEMA=public`
  - `SESSION_LEASE_REPOSITORY_TABLE=issue_session_leases`
- Frame metadata:
  - `SESSION_FRAME_REPOSITORY=file|postgres`
  - `SESSION_FRAME_REPOSITORY_SCHEMA=public`
  - `SESSION_FRAME_REPOSITORY_TABLE=issue_session_frames`
- Initial schema file: `sql/003_issue_session_operations.sql`

## Railway deploy
Use Docker deploy for this service (`issues-game-bot/Dockerfile`) so Node and Python/ViZDoom are always installed together.

Required vars:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL=https://<your-railway-domain>`
- `DATABASE_URL=postgres://...`
- `S3_BUCKET_NAME=...`
- `S3_FOLDER_NAME=frames`
- `AWS_REGION=us-east-1`
- `AWS_ACCESS_KEY_ID=...`
- `AWS_SECRET_ACCESS_KEY=...`
- If using Supabase for the DB:
  - `DATABASE_URL=...` from the Supabase project `Connect` dialog
- Optional: `PYTHON_BIN=python3`, `DOOM_TICS_PER_COMMENT=5`
- Optional: `DOOM_BOOT_DELAY_MS=0` (delay before the background live-session boot job starts; keep at `0` unless you deliberately want slower issue-open fanout)
- Optional: `DOOM_MODE=demons|classic` (default `demons`; use `classic` to attempt IWAD startup path)
- Optional: `DOOM_ENGINE=doomgeneric|vizdoom` (default `doomgeneric`, falls back to vizdoom if startup fails)
- Optional: `DOOM_PERSISTENT_ENGINE=auto|true|false` (default `auto`; auto now keeps the persistent worker enabled and primes it behind cached boot/menu frames so later comments can stay on DoomGeneric without first-comment startup stalls)
- Optional: `DOOM_SESSION_WORKER_TIMEOUT_MS=20000` (normal persistent-worker request timeout)
- Optional: `DOOM_SESSION_WORKER_STARTUP_TIMEOUT_MS=60000` (longer timeout for initial persistent-worker boot/snapshot)
- Optional: `DOOM_SESSION_WORKER_READY_TIMEOUT_MS=60000` (how long the Python wrapper waits for the DoomGeneric session binary to emit `READY` after warmup; defaults to the startup timeout if unset)
- Optional: `DOOM_INACTIVITY_MS=300000` (session manager exits the game after 5 minutes of inactivity)
- Optional boot-frame latency controls:
  - `DOOM_BOOT_FRAME_CACHE=true` (publish a cached placeholder frame immediately on issue open)
  - `DOOM_BOOT_FRAME_PREWARM=true` (generate the cached boot frame during startup instead of first traffic)
- Optional startup-menu cache controls:
  - `DOOM_MENU_FRAME_CACHE=true` (reuse locally pre-rendered early menu/startup frames for common exact command histories)
  - `DOOM_MENU_FRAME_PREWARM=true` (generate those menu-cache frames during startup instead of first use)
  - `MENU_FRAME_S3_PREFIX=frames/menu-cache` (optional override for the shared S3 object prefix used by cached menu frames)
- Optional render-performance controls:
  - `DOOM_FRAME_SCALE=0.8` (downscale output frame for faster transfer/render)
  - `DOOM_PNG_COMPRESS_LEVEL=3`
  - `DOOM_PNG_OPTIMIZE=false`
  - `DOOM_TICS_PER_COMMENT=4` (lower values reduce per-action compute time)

## GitHub webhook
- URL: `https://<domain>/webhook`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET`
- Events: `Issues`, `Issue comments`

## Notes
- This is still turn-based because GitHub comments are event-driven.
- Renderer defaults to `doomgeneric` backend (full Doom code path with `doom1.wad`), with automatic `vizdoom` fallback if runtime/backend initialization fails.
- Active sessions prefer in-memory state first, then repository fallback, to reduce per-command latency.
- Runtime boot now restores active sessions from the repository and re-arms inactivity timers.
- Frame publishing now supports local disk or S3-backed public objects.
- Remote frame objects are now written to tick-versioned keys, which avoids stale loading and early-action images caused by overwriting the same object path.
- Issue-open now publishes a cached boot frame immediately, then swaps to the real first frame once the live session is ready.
- Common early menu histories now have a local startup-frame cache fast path, which avoids live render work for the first few menu-selection screens.
- Those cached early states now also prime the DoomGeneric persistent worker in the background so the first uncached comment can reuse a hot live session instead of discovering worker startup at comment time.
- When S3 is enabled, those cached menu frames can also be published once to a shared deterministic S3 prefix, which lets repeated early menu states reuse one public object URL instead of re-uploading a fresh frame each time.
- Session transitions are recorded in an append-only event journal for debugging and future replay.
- Applied commands, session leases, and published frame metadata now have dedicated operational repositories instead of living only inside `session_json`.
- `/health` now includes runtime repository mode and DB-backed health when available.
- `/debug/issues/:id`, `/debug/issues/:id/events`, `/debug/issues/:id/commands`, `/debug/issues/:id/frames`, and `/debug/leases` expose the live/runtime operational view.
- Closing a GitHub issue freezes that session as an issue-state action.
- Inactive games exit after 5 minutes by default via the session manager timer; the GitHub issue remains open and `restart` starts a new run.
- Sessions: `data/sessions/<issue>.json`
- Frames: `data/frames/<issue>.png`
- Events: `data/events/<issue>.json`
- Commands: `data/commands/<issue>.json`
- Leases: `data/leases/<issue>.json`
- Frame metadata: `data/frame-meta/<issue>.json`
