# Build Progress Blog (V1)

This note summarizes how the project evolved from early experiments to the current DoomGeneric-first release shape.

## Phase 1: Early Direction (Pre-Doom Pipeline)

Initial prototypes were closer to experimental game interfaces than real Doom rendering.  
The major pivot was choosing GitHub Issues as interface transport:

- Issues/comments as input
- Webhooks for event delivery
- Issue body markdown as output surface

## Phase 2: ASCII End-to-End Prototype

First complete version used text-style rendering:

- one issue = one session
- one comment = one action tick
- issue body updated with ASCII/state output

This validated architecture, but not visual goals.

## Phase 3: PNG Frame Output

The project switched from ASCII to image frames:

- generate PNG per update
- serve via `/frames/<issue>.png`
- embed in issue markdown

### Progress Snapshot

![Progress image 3](../../image-3.png)

## Phase 4: Real Engine Integration (ViZDoom)

System split became clear:

- Node: webhook/session/GitHub orchestration
- Python: engine replay + frame generation

This delivered true engine-rendered frames.

### Progress Snapshot

![Progress image 4](../../image-4.png)

## Phase 5: Deployment Hardening

Major runtime issues appeared in hosted environments:

- runtime mismatch between Node/Python stacks
- package/runtime compatibility problems
- webhook timeout pressure under heavy render steps

Fixes included Dockerized unified runtime and asynchronous `202` webhook acknowledgement with background processing.

## Phase 6: Observability and Reliability Controls

Added operational signals and flow controls:

- `/health`
- `/debug/issues/:id`
- per-issue cooldown
- per-issue lock serialization

## Phase 7: DoomGeneric Migration + Proper Loading UX

Primary renderer moved to DoomGeneric for more classic behavior, with ViZDoom fallback for resilience.

Additional UX and control improvements:

- visible loading state on issue open
- boot delay so loading is actually visible
- stronger command/input timing behavior
- aliases for practical control (`left/right/up/down`, `shoot`, `escape`)

### Progress Snapshot

![Progress image 6](../../image-6.png)

## Current V1 Shape

Pipeline now:

`GitHub Issue/Comment -> Webhook Validate -> Queue + Issue Lock -> Session Update -> DoomGeneric Render (ViZDoom fallback) -> Frame Save -> Issue Body Update`

This version is stable as a turn-based GitHub-issues Doom control plane with real frame output and async processing.
