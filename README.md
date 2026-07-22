# doom-on-github-issues

Active project is in `issues-game-bot/`.

<img width="695" height="647" alt="image" src="https://github.com/user-attachments/assets/b8ea8409-ce78-4814-9721-439e4e0f4e6f" />

<img width="3177" height="977" alt="image" src="https://github.com/user-attachments/assets/ba6401dc-167c-4dd8-bc08-6ff1cc3fe8b1" />


This repository hosts a GitHub-Issues-driven Doom experiment:
- one issue = one game session
- one comment = one action tick
- issue body is updated with latest rendered frame

## Release

Current release: `v4.0.0`

V4 is the DoomGeneric persistence and latency release. It keeps GitHub Issues as the interface while adding cached startup/menu frames, deterministic S3 frame delivery, batched comment commands, and a persistent DoomGeneric worker path.

See `CHANGELOG.md` and `documentation/v4-release-notes/` for the release notes and system design docs.
