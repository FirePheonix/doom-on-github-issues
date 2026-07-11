# V4 Release Summary

## Theme

V4 turns the project from a replay-heavy prototype into a faster, DoomGeneric-first runtime. The main goal is simple: a GitHub comment should produce one final frame as quickly as possible, without replaying the entire issue history when a live DoomGeneric session is available.

## User-Facing Improvements

- A comment with multiple commands, such as:

```text
ww
enter
space
d3
fire
```

is parsed into one ordered command batch and produces one final issue-frame update.

- Early menu states are served from cached PNGs.
- Shared cached menu frames are stored in S3 at deterministic names.
- Repeated shared menu frame uploads are skipped after the first publish in the process.
- GitHub webhook responses stay fast; render work happens in the queued job.
- Timing logs make latency visible without guesswork.

## Runtime Improvements

- Persistent DoomGeneric sessions are strict when `DOOM_ENGINE=doomgeneric`.
- The C session worker now follows the DoomGeneric port model: create once, then tick continuously.
- The Python wrapper ignores normal DoomGeneric startup banner lines on stdout and waits for protocol replies.
- Background persistent sync can use a longer hidden timeout while visible comments keep a short fallback budget.
- Background sync targets are coalesced, so cached menu history `1 -> 2 -> 3` does not force stale sync work before catching up to the latest target.

## Removed Complexity

- Redis is no longer part of the menu-frame cache design.
- Operational event, command, lease, and frame metadata repositories are no longer on the visible gameplay hot path.
- The issue body does not wait on debug bookkeeping before the visible frame update.

## Known Boundaries

- GitHub issue PATCH latency still exists and is outside the app.
- GitHub image refresh/proxy latency still exists and is outside the app.
- S3 publish time is visible for uncached live frames.
- DoomGeneric worker health still matters. V4 exposes worker state more clearly, but cannot make a broken native worker healthy from JavaScript alone.
