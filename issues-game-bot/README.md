# Issues Doom Bot

Turn-based Doom sessions driven by GitHub Issues/comments, rendered with a real Doom engine backend (ViZDoom) on classic Doom shareware IWAD.

## How it works
- New issue opens a new session (`issue_number` == session ID).
- Every new comment is one input action.
- Node webhook handler stores session state/history.
- Python worker (`scripts/doom_worker.py`) replays history in ViZDoom (E1M1 start) and writes a PNG frame.
- Issue body embeds `/frames/<issue>.png` so each action updates graphics.

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
- Optional: `DOOM_INACTIVITY_MS=300000` and `DOOM_INACTIVITY_SCAN_MS=60000` (auto-pause inactive sessions and notify via issue comment)
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
- Closing an issue freezes that session; reopening resumes it.
- Inactive sessions (5+ minutes by default) are auto-paused and require `restart` or issue reopen.
- Sessions: `data/sessions/<issue>.json`
- Frames: `data/frames/<issue>.png`
