import { renderEngineFrame } from "../engine.js";
import { getFramePath, getSessionPath, saveSession } from "../storage.js";

export async function persistSessionArtifacts({
  projectRoot,
  issueNumber,
  state,
  engine = null,
  mode = "step",
  appliedCommands = []
}) {
  await saveSession(issueNumber, state);

  const sessionPath = getSessionPath(issueNumber);
  const framePath = getFramePath(issueNumber);

  try {
    if (!engine) {
      await renderEngineFrame(projectRoot, sessionPath, framePath);
      return;
    }

    if (mode === "start") {
      await engine.startSession(issueNumber, state.seed, framePath);
      return;
    }

    if (mode === "restart") {
      await engine.restartSession(issueNumber, state.seed, framePath);
      return;
    }

    if (mode === "step" && appliedCommands.length > 0) {
      const prefixLen = Math.max(0, state.history.length - appliedCommands.length);
      const historyPrefix = state.history.slice(0, prefixLen);
      await engine.applyCommands(issueNumber, state.seed, framePath, historyPrefix, appliedCommands);
    }
  } catch (error) {
    console.error(`Persistent engine path failed for issue ${issueNumber}; falling back to replay renderer`, error);
    if (engine?.invalidate) {
      await engine.invalidate(issueNumber);
    }
    await renderEngineFrame(projectRoot, sessionPath, framePath);
  }
}
