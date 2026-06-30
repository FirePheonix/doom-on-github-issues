import { renderEngineFrame } from "../engine.js";
import { getFramePath, getSessionPath } from "../storage.js";

export async function persistSessionArtifacts({
  projectRoot,
  issueNumber,
  state,
  frameStore,
  sessionRepository,
  sessionManager = null,
  mode = "step",
  appliedCommands = []
}) {
  await sessionRepository.save(issueNumber, state);

  const sessionPath = getSessionPath(issueNumber);
  const framePath = getFramePath(issueNumber);
  sessionManager?.rememberState?.(issueNumber, state, framePath);

  try {
    if (!sessionManager) {
      await renderEngineFrame(projectRoot, sessionPath, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      return;
    }

    if (mode === "start") {
      await sessionManager.startSession(issueNumber, state.seed, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      return;
    }

    if (mode === "restart") {
      await sessionManager.restartSession(issueNumber, state.seed, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      return;
    }

    if (mode === "step" && appliedCommands.length > 0) {
      const prefixLen = Math.max(0, state.history.length - appliedCommands.length);
      const historyPrefix = state.history.slice(0, prefixLen);
      await sessionManager.applyCommands(issueNumber, state.seed, framePath, historyPrefix, appliedCommands);
      await frameStore.publish(issueNumber, state.tick, framePath);
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
  }
}
