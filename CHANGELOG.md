# Changelog

## v4.0.0 - DoomGeneric Persistence And Latency Release

V4 focuses on making GitHub-Issues Doom feel responsive while keeping DoomGeneric as the primary engine path.

### What works
- Cached boot and startup menu frames for common early histories.
- Shared cached menu frames published to deterministic S3 object keys.
- No Redis dependency for menu-frame cache lookups.
- Multiline and compact comment commands execute as one batch and publish one final frame.
- Persistent DoomGeneric session worker with a continuous ticking native loop.
- Strict `DOOM_ENGINE=doomgeneric` behavior for persistent sessions.
- Replay fallback remains available when the live worker is not ready.
- Background persistent sync coalesces to the newest target history.
- Timing logs for render, publish, GitHub PATCH, and total queued job time.
- User-facing persistent startup wait is short, while hidden background priming can use a longer budget.

### System design docs
- `documentation/v4-release-notes/release.md`
- `documentation/v4-release-notes/architecture.md`
- `documentation/v4-release-notes/sequences.md`
- `documentation/v4-release-notes/persistent-doomgeneric.md`
- `documentation/v4-release-notes/latency-and-caching.md`
- `documentation/v4-release-notes/operations.md`

### Known limitations
- GitHub issue PATCH and image refresh latency are still outside the app.
- S3 upload time still affects uncached live frames.
- If the native DoomGeneric worker fails to boot, the app falls back to replay rendering.
- The in-process queue and per-instance session manager are still not a distributed worker system.

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
