# Issues Doom Bot

Turn-based Doom sessions driven by GitHub Issues/comments, rendered through a DoomGeneric-first engine pipeline with ViZDoom fallback.

## How it works
- New issue opens a new session (`issue_number` == session ID).
- Every new comment is one input action.
- Node webhook handler stores session state/history.
- Session manager owns one live runtime per active issue and enforces inactivity expiry.
- Python worker pipeline uses a persistent Doom session worker first, with replay fallback when needed.
- Issue body embeds `/frames/<issue>.png` so each action updates graphics.

## Code layout
- `src/server.js`: app composition and dependency wiring only.
- `src/runtime.js`: runtime service composition for server boot and smoke tests.
- `src/routes/`: HTTP endpoints (`/webhook`, `/frames`, `/health`, `/debug`).
- `src/github/`: GitHub client, webhook validation, issue update/comment helpers.
- `src/jobs/`: async webhook job queue, per-issue locks, debug status.
- `src/sessions/`: command normalization, lifecycle, inactivity, session manager, persistence artifacts.
- `src/views/`: GitHub issue markdown rendering for loading/game screens.
- `src/renderer/`: frame URL/render-adapter helpers.
- `scripts/`: Python/C Doom renderer pipeline.

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
3. Configure env (`.env`).
4. Run server:
```bash
npm start
```
5. Run local smoke checks:
```bash
npm run render:smoke
npm run e2e:smoke
```

## Railway deploy
Use Docker deploy for this service (`issues-game-bot/Dockerfile`) so Node and Python/ViZDoom are always installed together.

Required vars:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL=https://<your-railway-domain>`
- Optional: `PYTHON_BIN=python3`, `DOOM_TICS_PER_COMMENT=5`
- Optional: `DOOM_BOOT_DELAY_MS=500` (lower values improve first-frame delivery speed)
- Optional: `DOOM_MODE=demons|classic` (default `demons`; use `classic` to attempt IWAD startup path)
- Optional: `DOOM_ENGINE=doomgeneric|vizdoom` (default `doomgeneric`, falls back to vizdoom if startup fails)
- Optional: `DOOM_INACTIVITY_MS=300000` (session manager exits the game after 5 minutes of inactivity)
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
- Closing a GitHub issue freezes that session as an issue-state action.
- Inactive games exit after 5 minutes by default via the session manager timer; the GitHub issue remains open and `restart` starts a new run.
- Sessions: `data/sessions/<issue>.json`
- Frames: `data/frames/<issue>.png`
