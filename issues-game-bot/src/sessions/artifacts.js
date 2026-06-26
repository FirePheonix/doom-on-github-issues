import { renderEngineFrame } from "../engine.js";
import { getFramePath, getSessionPath, saveSession } from "../storage.js";

export async function persistSessionArtifacts(projectRoot, issueNumber, state) {
  await saveSession(issueNumber, state);
  await renderEngineFrame(projectRoot, getSessionPath(issueNumber), getFramePath(issueNumber));
}

