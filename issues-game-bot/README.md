# Issues Doom Bot

Turn-based Doom sessions driven by GitHub Issues/comments, rendered with a real Doom engine backend (ViZDoom).

## How it works
- New issue opens a new session (`issue_number` == session ID).
- Every new comment is one input action.
- Node webhook handler stores session state/history.
- Python worker (`scripts/doom_worker.py`) replays history in ViZDoom and writes a PNG frame.
- Issue body embeds `/frames/<issue>.png` so each action updates graphics.

## Commands
- `w`: move forward
- `s`: move backward
- `a`: turn left
- `d`: turn right
- `fire` (or `enter`): attack
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
python scripts/fetch_vizdoom_assets.py
```
3. Configure env (`.env`).
4. Run server:
```bash
npm start
```

## Railway deploy
This project includes `nixpacks.toml` so Railway installs both Node and Python + ViZDoom requirements.

Required vars:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL=https://<your-railway-domain>`
- Optional: `PYTHON_BIN=python3`, `DOOM_TICS_PER_COMMENT=5`

## GitHub webhook
- URL: `https://<domain>/webhook`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET`
- Events: `Issues`, `Issue comments`

## Notes
- This is still turn-based because GitHub comments are event-driven.
- Renderer now uses real Doom engine frames from ViZDoom (scenario assets).
- Sessions: `data/sessions/<issue>.json`
- Frames: `data/frames/<issue>.png`
