import { publishCachedMenuFrame } from "../menuFrame/cache.js";
import { renderEngineFrame } from "../engine.js";
import { getFramePath, getSessionPath } from "../storage.js";

export async function persistSessionArtifacts({
  projectRoot,
  issueNumber,
  state,
  frameStore,
  sessionManager = null,
  mode = "step",
  appliedCommands = []
}) {
  const sessionPath = getSessionPath(issueNumber);
  const framePath = getFramePath(issueNumber);
  sessionManager?.rememberState?.(issueNumber, state, framePath);

  try {
    const cachedMenuFrame = await publishCachedMenuFrame({
      projectRoot,
      issueNumber,
      history: state.history,
      framePath,
      frameStore
    });
    if (cachedMenuFrame) {
      return {
        imageUrlOverride: cachedMenuFrame.sharedUrl || ""
      };
    }

    if (!sessionManager) {
      await renderEngineFrame(projectRoot, sessionPath, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      return {
        imageUrlOverride: ""
      };
    }

    if (mode === "start") {
      await sessionManager.startSession(issueNumber, state.seed, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      return {
        imageUrlOverride: ""
      };
    }

    if (mode === "restart") {
      await sessionManager.restartSession(issueNumber, state.seed, framePath);
      await frameStore.publish(issueNumber, state.tick, framePath);
      return {
        imageUrlOverride: ""
      };
    }

    if (mode === "step" && appliedCommands.length > 0) {
      const prefixLen = Math.max(0, state.history.length - appliedCommands.length);
      const historyPrefix = state.history.slice(0, prefixLen);
      await sessionManager.applyCommands(issueNumber, state.seed, framePath, historyPrefix, appliedCommands);
      await frameStore.publish(issueNumber, state.tick, framePath);
      return {
        imageUrlOverride: ""
      };
    }

    sessionManager.setStatus(issueNumber, state.status);
    return {
      imageUrlOverride: ""
    };
  } catch (error) {
    console.error(`Persistent engine path failed for issue ${issueNumber}; falling back to replay renderer`, error);
    if (sessionManager?.invalidate) {
      await sessionManager.invalidate(issueNumber);
    }
    await renderEngineFrame(projectRoot, sessionPath, framePath);
    await frameStore.publish(issueNumber, state.tick, framePath);
    return {
      imageUrlOverride: ""
    };
  }
}
