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
  const supportsLiveRendering = sessionManager?.supportsLiveRendering?.() ?? false;
  const primeLiveSession = () => {
    sessionManager?.primeSession?.(issueNumber, state.seed, framePath, state.history);
  };

  try {
    const renderStartedMs = Date.now();
    const cachedMenuFrame = await publishCachedMenuFrame({
      projectRoot,
      issueNumber,
      history: state.history,
      framePath,
      frameStore
    });
    if (cachedMenuFrame) {
      primeLiveSession();
      console.log(`issue=${issueNumber} render_done ms=${Date.now() - renderStartedMs} cache_hit=true`);
      console.log(`issue=${issueNumber} publish_done ms=0 cache_hit=true`);
      return {
        imageUrlOverride: cachedMenuFrame.sharedUrl || ""
      };
    }

    if (!sessionManager || !supportsLiveRendering) {
      await renderEngineFrame(projectRoot, sessionPath, framePath);
      const liveRenderReason = !sessionManager
        ? "no_session_manager"
        : (sessionManager.getLiveRenderDisableReason?.() || "persistent_engine_disabled");
      console.log(`issue=${issueNumber} render_done ms=${Date.now() - renderStartedMs} cache_hit=false mode=replay reason=${liveRenderReason}`);
      const publishStartedMs = Date.now();
      await frameStore.publish(issueNumber, state.tick, framePath);
      console.log(`issue=${issueNumber} publish_done ms=${Date.now() - publishStartedMs} cache_hit=false`);
      primeLiveSession();
      return {
        imageUrlOverride: ""
      };
    }

    if (mode === "start") {
      await sessionManager.startSession(issueNumber, state.seed, framePath);
      console.log(`issue=${issueNumber} render_done ms=${Date.now() - renderStartedMs} cache_hit=false mode=start`);
      const publishStartedMs = Date.now();
      await frameStore.publish(issueNumber, state.tick, framePath);
      console.log(`issue=${issueNumber} publish_done ms=${Date.now() - publishStartedMs} cache_hit=false`);
      return {
        imageUrlOverride: ""
      };
    }

    if (mode === "restart") {
      await sessionManager.restartSession(issueNumber, state.seed, framePath);
      console.log(`issue=${issueNumber} render_done ms=${Date.now() - renderStartedMs} cache_hit=false mode=restart`);
      const publishStartedMs = Date.now();
      await frameStore.publish(issueNumber, state.tick, framePath);
      console.log(`issue=${issueNumber} publish_done ms=${Date.now() - publishStartedMs} cache_hit=false`);
      return {
        imageUrlOverride: ""
      };
    }

    if (mode === "step" && appliedCommands.length > 0) {
      const prefixLen = Math.max(0, state.history.length - appliedCommands.length);
      const historyPrefix = state.history.slice(0, prefixLen);
      await sessionManager.applyCommands(issueNumber, state.seed, framePath, historyPrefix, appliedCommands);
      console.log(`issue=${issueNumber} render_done ms=${Date.now() - renderStartedMs} cache_hit=false mode=step`);
      const publishStartedMs = Date.now();
      await frameStore.publish(issueNumber, state.tick, framePath);
      console.log(`issue=${issueNumber} publish_done ms=${Date.now() - publishStartedMs} cache_hit=false`);
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
    if (sessionManager?.invalidate && !(error instanceof Error && error.message.startsWith("persistent_engine_not_ready"))) {
      await sessionManager.invalidate(issueNumber);
    }
    const renderStartedMs = Date.now();
    await renderEngineFrame(projectRoot, sessionPath, framePath);
    console.log(`issue=${issueNumber} render_done ms=${Date.now() - renderStartedMs} cache_hit=false mode=fallback`);
    const publishStartedMs = Date.now();
    await frameStore.publish(issueNumber, state.tick, framePath);
    console.log(`issue=${issueNumber} publish_done ms=${Date.now() - publishStartedMs} cache_hit=false`);
    primeLiveSession();
    return {
      imageUrlOverride: ""
    };
  }
}
