# Build Walkthrough

This is the step-by-step record of how the project moved from a GitHub issue experiment into the V4 persistent Doom runtime.

## 1. Start With GitHub Issues as the Game Surface

The first decision was to make GitHub Issues both the controller and the display. One issue represents one game session, and each new comment is treated as a command batch. The issue body is rewritten after each accepted comment so the latest frame and session state are always visible in the same place.

![The first issue-backed session with a generated frame and command comment.](/build-walkthrough/image-3.png)

The initial loop was intentionally small:

1. Receive an issue comment webhook.
2. Parse the comment body into movement or action commands.
3. Advance the session by one or more ticks.
4. Render or reuse the current frame.
5. Patch the issue body with the image, stats, controls, and recent log.

That gave the project a simple contract: GitHub stores the conversation, comments drive input, and the issue body acts like the screen.

## 2. Prove the Comment-to-Tick Loop

After the first frame pipeline existed, I tested the minimum interaction model by commenting single commands such as `w`. The session body showed the latest tick, health, kill count, running status, and control hints.

![A command comment under an issue session.](/build-walkthrough/image-5.png)

At this stage the important part was not visual fidelity. The important part was proving that a normal GitHub issue comment could be accepted as game input without needing a custom frontend.

## 3. Replace Placeholder Rendering With Engine Frames

The early renderer proved the workflow, but the project needed real Doom frames. The next step was wiring the backend to a Doom-capable renderer and returning real game output into the same issue markdown shape.

![A real Doom frame rendered back into the issue body.](/build-walkthrough/image-4.png)

This is where the issue body format became stable:

- latest rendered image
- tick count
- health and kill data when the engine owns those values
- renderer name
- accepted controls
- short recent log

That stable markdown view let the renderer change underneath without changing how the user played.

## 4. Add the VizDoom Path

VizDoom became the first practical real-frame path. The backend could start a session, render a frame, and publish that frame into the issue body while keeping GitHub as the interface.

![VizDoom frame output in a running issue session.](/build-walkthrough/image-6.png)

The server side now had clearer responsibilities:

- `routes/webhook.js` accepts GitHub events and schedules work.
- `jobs/queue.js` keeps webhook responses fast.
- `jobs/locks.js` serializes work per issue.
- `sessions/lifecycle.js` loads state, applies commands, and prepares the update.
- `sessions/artifacts.js` chooses how to produce the current frame.
- `src/engine.js` owns renderer process calls.

This split made the system easier to evolve because GitHub delivery, session mutation, and frame production were no longer tangled together.

## 5. Keep Sessions Alive Across Comments

Replay rendering worked, but it became slower as command history grew. Later frames had to replay more of the session from tick 0. V4 changed the direction: keep a live DoomGeneric worker around for each active session and apply only the newest command batch.

![A live session after several accepted commands.](/build-walkthrough/image-7.png)

The persistent model changed the hot path from "replay everything" to "step the live worker":

1. Load the current session record.
2. Append accepted commands to history.
3. Ask the live worker to step only those commands.
4. Capture the resulting frame.
5. Publish the frame and patch GitHub.

If the worker is not ready, the system can still fall back to a replay path. That keeps the user-facing comment loop resilient while the persistent worker warms up in the background.

## 6. Restore the Full Doom HUD

Once real rendering and persistence were in place, the next visible improvement was making the frame look like the expected Doom experience. The issue body can display the full frame, including the weapon, face, ammo, health, armor, and status bar.

![The full Doom HUD rendered inside GitHub Issues.](/build-walkthrough/image-8.png)

This confirmed that the issue body was not just showing debug images. It could carry a recognizable game view while still keeping the session metadata below the frame.

## 7. Add Operational Guardrails

The GitHub interface also needs to handle inactive sessions cleanly. When a session is paused, new comments should not silently mutate stale state. The app responds with a clear pause message and tells the user how to start again.

![Paused-session responses in the issue thread.](/build-walkthrough/image-9.png)

The same behavior appears at the bottom of longer threads, which keeps the interaction understandable even after many comments.

![Paused session near the issue comment box.](/build-walkthrough/image-10.png)

This guardrail matters because the project uses GitHub as the UI. Every state transition has to be visible in the thread, not hidden in server logs.

## 8. Ship the V4 Runtime Shape

The final V4 shape keeps the GitHub Issues interface and makes the backend thinner:

1. Comment webhooks are acknowledged quickly.
2. Per-issue locks prevent concurrent state corruption.
3. Commands are batched from each comment.
4. Cached boot and menu frames avoid repeated startup work.
5. Persistent DoomGeneric workers keep live state in memory.
6. Frame stores publish either local or S3-backed image URLs.
7. The issue body is patched with the final frame for the command batch.

The result is still the original idea: play Doom by commenting on a GitHub issue. The difference is that V4 makes that idea practical by adding persistence, caching, operational state, and a renderer pipeline that can survive real usage.
