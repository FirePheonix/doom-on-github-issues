# Contributing to doom-on-github-issues

This repository is open source, and focused changes are welcome.

## Before you start

- Read `README.md` and the release notes in `documentation/`.
- Keep changes scoped to the active issue or feature.
- Preserve the GitHub Issues-driven game flow unless the change is explicitly about reworking it.

## Local setup

```bash
cd issues-game-bot
npm install
pip install -r requirements.txt
python scripts/fetch_doom_assets.py
```

## What to check

- `npm run render:smoke`
- `npm run e2e:smoke`
- `npm run frame-store:smoke`
- `npm run recovery:smoke`
- `npm run repository-mode:smoke`

## Pull request expectations

- Explain what changed and why.
- Mention any setup or environment changes.
- Include screenshots or frame samples when the rendering or UI changes.
- Avoid unrelated refactors.

## Project rules

- Keep GitHub Issues as the session controller.
- Keep comments as turn-based commands.
- Keep frame updates deterministic and attributable.
