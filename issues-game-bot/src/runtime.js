import { readGithubTarget, readRuntimeConfig } from "./config/env.js";
import { createGithubClient } from "./github/client.js";
import { ensureEngineAssets } from "./engine.js";
import { createJobQueue } from "./jobs/queue.js";
import { createLockStore } from "./jobs/locks.js";
import { createJobStatusStore } from "./jobs/status.js";
import { expireIssueSession } from "./sessions/lifecycle.js";
import { createSessionManager } from "./sessions/manager.js";
import { createIssueThrottle } from "./sessions/throttle.js";

export function createRuntimeServices({
  projectRoot = process.cwd(),
  github = createGithubClient(),
  config = readRuntimeConfig(),
  sessionManager = null,
  beforeJob = null
} = {}) {
  const lockStore = createLockStore();
  const jobStatusStore = createJobStatusStore();
  const jobQueue = createJobQueue({
    statusStore: jobStatusStore,
    beforeJob: beforeJob ?? (sessionManager ? null : () => ensureEngineAssets(projectRoot))
  });
  const throttle = createIssueThrottle(config.issueCooldownMs);

  const managedSessionManager = sessionManager || createSessionManager({
    projectRoot,
    inactivityMs: config.inactivityMs,
    onExpire: async (issueNumber) => {
      if (!github) return;
      const { owner, repo } = readGithubTarget();
      jobQueue.schedule(issueNumber, async () => {
        await lockStore.withIssueLock(issueNumber, async () => {
          await expireIssueSession({
            github,
            owner,
            repo,
            issueNumber,
            sessionManager: managedSessionManager,
            inactivityMs: config.inactivityMs
          });
        });
      });
    }
  });

  return {
    projectRoot,
    github,
    config,
    lockStore,
    jobStatusStore,
    jobQueue,
    throttle,
    sessionManager: managedSessionManager
  };
}
