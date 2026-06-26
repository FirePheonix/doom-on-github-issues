# Changelog

## v0.1.0 - Doom in GitHub Issues

First public prototype release.

### What works
- One GitHub issue starts one Doom session.
- One GitHub comment advances the game by one command.
- Issue body updates with the latest rendered Doom frame.
- Real Doom rendering path through `doomgeneric`, with ViZDoom fallback.
- Railway Docker deployment path for Node, Python, and Doom renderer dependencies.
- Webhook verification using `GITHUB_WEBHOOK_SECRET`.
- Async webhook handling so GitHub gets a fast `202` response.
- Per-issue locking and debug job status endpoint.
- Commands: `w`, `a`, `s`, `d`, `fire`, `enter`, `esc`, `exit`, `restart`, `help`.
- Inactivity exits the game session without closing the GitHub issue.

### Known limitations
- Gameplay is turn-based because GitHub comments are the controller.
- Frame/session state is local to the running service.
- Each render is still designed for demo-scale usage, not large-scale multiplayer traffic.
- GitHub Issues and GitHub API latency dominate move-to-frame delay.

### Next targets
- Persistent session storage.
- Object storage/CDN for frames.
- Queue-backed render workers.
- Better Doom input/runtime state handling.

