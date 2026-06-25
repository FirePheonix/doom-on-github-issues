# Issues Doom Bot

Turn-based Doom-like game sessions driven by GitHub Issues and comments, rendered as PNG frames.

## How it works
- New issue opens a new game session (`issue_number` == session ID).
- Every new comment is one command tick.
- The bot raycasts a new frame and saves `data/frames/<issue>.png`.
- The issue body embeds the latest frame image URL.

## Commands
- `w`: move forward
- `s`: move backward
- `a`: turn left
- `d`: turn right
- `fire` (or `enter`): shoot
- `restart`
- `help`

## Setup
1. Install deps:
```bash
npm install
```
2. Create env file:
```bash
cp .env.example .env
```
3. Set env values:
- `GITHUB_TOKEN`: token with `Issues: Read and write`
- `GITHUB_OWNER`, `GITHUB_REPO`
- `GITHUB_WEBHOOK_SECRET`
- Optional `PUBLIC_BASE_URL` (recommended on hosted deployments)
4. Run locally:
```bash
npm start
```
5. Create GitHub webhook:
- Payload URL: `https://<your-host>/webhook`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET`
- Events: `Issues`, `Issue comment`

## Railway deploy
1. Deploy from GitHub repo.
2. Root directory: `issues-game-bot`.
3. Build command: `npm ci`
4. Start command: `npm start`
5. Add variables:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL=https://<your-domain>`

## Notes
- This is turn-based via GitHub comments, not real-time.
- Sessions are in `data/sessions/<issue>.json`.
- Frames are in `data/frames/<issue>.png`.
- Webhooks are validated by signature and repository match.
