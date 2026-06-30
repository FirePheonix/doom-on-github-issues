import { readGithubTarget, readRuntimeConfig } from "./config/env.js";
import { createGithubClient } from "./github/client.js";
import { ensureEngineAssets } from "./engine.js";
import { createJobQueue } from "./jobs/queue.js";
import { createLockStore } from "./jobs/locks.js";
import { createJobStatusStore } from "./jobs/status.js";
import { createSessionEventRepository, createSessionRepository } from "./persistence/index.js";
import { getFramePath } from "./storage.js";
import { expireIssueSession } from "./sessions/lifecycle.js";
import { createSessionManager } from "./sessions/manager.js";
import { createIssueThrottle } from "./sessions/throttle.js";

export function createRuntimeServices({
  projectRoot = process.cwd(),
  github = createGithubClient(),
  config = readRuntimeConfig(),
  sessionRepository = createSessionRepository(),
  sessionEventRepository = createSessionEventRepository(),
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
  const recovery = {
    primed: false,
    restoredCount: 0,
    restoredIssueNumbers: [],
    primeAt: null
  };
  const repositoryInfo = {
    sessionRepositoryKind: sessionRepository.kind,
    sessionEventRepositoryKind: sessionEventRepository.kind
  };

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
            sessionRepository,
            sessionEventRepository,
            inactivityMs: config.inactivityMs
          });
        });
      });
    }
  });

  async function prime() {
    if (recovery.primed) {
      return recovery;
    }

    const activeStates = sessionRepository.listByStatus
      ? await sessionRepository.listByStatus(["active"])
      : [];

    for (const state of activeStates) {
      managedSessionManager.restoreSession(state, getFramePath(state.issueNumber));
      recovery.restoredIssueNumbers.push(state.issueNumber);
    }

    recovery.restoredCount = recovery.restoredIssueNumbers.length;
    recovery.primeAt = new Date().toISOString();
    recovery.primed = true;
    return recovery;
  }

  async function healthCheck() {
    const checks = [];

    if (typeof sessionRepository.healthCheck === "function") {
      checks.push(sessionRepository.healthCheck());
    }
    if (typeof sessionEventRepository.healthCheck === "function") {
      checks.push(sessionEventRepository.healthCheck());
    }

    await Promise.all(checks);
    return {
      ok: true,
      ...repositoryInfo
    };
  }

  return {
    projectRoot,
    github,
    config,
    lockStore,
    jobStatusStore,
    jobQueue,
    throttle,
    sessionRepository,
    sessionEventRepository,
    sessionManager: managedSessionManager,
    repositoryInfo,
    healthCheck,
    prime,
    recovery
  };
}
