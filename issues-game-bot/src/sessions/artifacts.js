import { renderEngineFrame } from "../engine.js";
import { inferBaseUrlFromEnv } from "../github/issues.js";
import { getFramePath, getSessionPath } from "../storage.js";

export async function persistSessionArtifacts({
  projectRoot,
  issueNumber,
  state,
  frameStore,
  sessionRepository,
  sessionFrameRepository = null,
  sessionManager = null,
  mode = "step",
  appliedCommands = []
}) {
  await sessionRepository.save(issueNumber, state);

  const sessionPath = getSessionPath(issueNumber);
  const framePath = getFramePath(issueNumber);
  sessionManager?.rememberState?.(issueNumber, state, framePath);

  async function recordPublishedFrame() {
    if (!sessionFrameRepository) {
      return;
    }

    let publicUrl = "";
    try {
      publicUrl = frameStore.publicUrl({
        issueNumber,
        tick: state.tick,
        baseUrl: inferBaseUrlFromEnv()
      }) || "";
    } catch {}

    await sessionFrameRepository.append(issueNumber, {
      issueNumber,
      tick: state.tick,
      frameStoreKind: frameStore.kind,
      frameRef: frameStore.kind === "local" ? framePath : (publicUrl || framePath),
      publicUrl,
      mode,
      publishedAt: new Date().toISOString()
    });
  }

  try {
    if (!sessionManager) {
      await renderEngineFrame(projectRoot, sessionPath, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      await recordPublishedFrame();
      return;
    }

    if (mode === "start") {
      await sessionManager.startSession(issueNumber, state.seed, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      await recordPublishedFrame();
      return;
    }

    if (mode === "restart") {
      await sessionManager.restartSession(issueNumber, state.seed, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      await recordPublishedFrame();
      return;
    }

    if (mode === "step" && appliedCommands.length > 0) {
      const prefixLen = Math.max(0, state.history.length - appliedCommands.length);
      const historyPrefix = state.history.slice(0, prefixLen);
      await sessionManager.applyCommands(issueNumber, state.seed, framePath, historyPrefix, appliedCommands);
      await frameStore.publish(issueNumber, state.tick, framePath);
      await recordPublishedFrame();
      return;
    }

    sessionManager.setStatus(issueNumber, state.status);
  } catch (error) {
    console.error(`Persistent engine path failed for issue ${issueNumber}; falling back to replay renderer`, error);
    if (sessionManager?.invalidate) {
      await sessionManager.invalidate(issueNumber);
    }
    await renderEngineFrame(projectRoot, sessionPath, framePath);
    await frameStore.publish(issueNumber, state.tick, framePath);
    await recordPublishedFrame();
  }
}
