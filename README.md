# doom-in-github-issues

Active project is in `issues-game-bot/`.

This repository hosts a GitHub-Issues-driven Doom experiment:
- one issue = one game session
- one comment = one action tick
- issue body is updated with latest rendered frame

## Release

Current release: `v4.0.0`

V4 is the DoomGeneric persistence and latency release. It keeps GitHub Issues as the interface while adding cached startup/menu frames, deterministic S3 frame delivery, batched comment commands, and a persistent DoomGeneric worker path.

See `CHANGELOG.md` and `documentation/v4-release-notes/` for the release notes and system design docs.
