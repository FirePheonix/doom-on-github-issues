import { renderEngineFrame } from "../engine.js";
import { getFramePath, getSessionPath, saveSession } from "../storage.js";

export async function persistSessionArtifacts({
  projectRoot,
  issueNumber,
  state,
  sessionManager = null,
  mode = "step",
  appliedCommands = []
}) {
  await saveSession(issueNumber, state);

  const sessionPath = getSessionPath(issueNumber);
  const framePath = getFramePath(issueNumber);

  try {
    if (!sessionManager) {
      await renderEngineFrame(projectRoot, sessionPath, framePath);
      return;
    }

    if (mode === "start") {
      await sessionManager.startSession(issueNumber, state.seed, framePath);
      return;
    }

    if (mode === "restart") {
      await sessionManager.restartSession(issueNumber, state.seed, framePath);
      return;
    }

    if (mode === "step" && appliedCommands.length > 0) {
      const prefixLen = Math.max(0, state.history.length - appliedCommands.length);
      const historyPrefix = state.history.slice(0, prefixLen);
      await sessionManager.applyCommands(issueNumber, state.seed, framePath, historyPrefix, appliedCommands);
      return;
    }

    sessionManager.setStatus(issueNumber, state.status);
  } catch (error) {
    console.error(`Persistent engine path failed for issue ${issueNumber}; falling back to replay renderer`, error);
    if (sessionManager?.invalidate) {
      await sessionManager.invalidate(issueNumber);
    }
    await renderEngineFrame(projectRoot, sessionPath, framePath);
  }
}
