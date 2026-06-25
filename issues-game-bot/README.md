# Issues Doom Bot

Turn-based Doom-like game sessions driven by GitHub Issues and comments.

## How it works
- New issue opens a new game session (`issue_number` == session ID).
- Every new comment is one command tick.
- The bot updates the issue body with an ASCII frame and HUD.

This follows the DoomPDF spirit (text framebuffer + event-driven input), adapted to GitHub events.

## Commands
- `w`, `a`, `s`, `d`
- `fire` (or `enter`)
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
- `GITHUB_TOKEN`: token with `repo` scope on target repo
- `GITHUB_OWNER`, `GITHUB_REPO`
- `GITHUB_WEBHOOK_SECRET`
4. Run locally:
```bash
npm start
```
5. Create GitHub webhook on your repo:
- Payload URL: `https://<your-host>/webhook`
- Content type: `application/json`
- Secret: same as `GITHUB_WEBHOOK_SECRET`
- Events: `Issues`, `Issue comment`

## Railway deploy
1. New Project -> Deploy from GitHub repo.
2. Keep repo root as-is; `railway.json` handles subdirectory commands.
3. Add variables in Railway:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_WEBHOOK_SECRET`
- `PORT` (Railway provides this automatically, but explicit is fine)
4. Deploy and copy your public URL.
5. Set GitHub webhook URL to `https://<your-railway-domain>/webhook`.

## Notes
- This is intentionally turn-based; each comment advances one game step.
- Session files are in `data/sessions/<issue>.json`.
- Webhooks are validated by signature and repository match.
- Rapid duplicate comments are throttled per issue.
