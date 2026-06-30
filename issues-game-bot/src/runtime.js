import os from "node:os";
import { ensureBootFrameCache, isBootFrameCacheEnabled, isBootFramePrewarmEnabled } from "./bootFrame/cache.js";
import { readGithubTarget, readRuntimeConfig } from "./config/env.js";
import { createFrameStore } from "./frameStore/index.js";
import { createGithubClient } from "./github/client.js";
import { ensureEngineAssets } from "./engine.js";
import { createJobQueue } from "./jobs/queue.js";
import { createLockStore } from "./jobs/locks.js";
import { createJobStatusStore } from "./jobs/status.js";
import {
  createSessionCommandRepository,
  createSessionEventRepository,
  createSessionFrameRepository,
  createSessionLeaseRepository,
  createSessionRepository
} from "./persistence/index.js";
import { getFramePath } from "./storage.js";
import { expireIssueSession } from "./sessions/lifecycle.js";
import { createSessionManager } from "./sessions/manager.js";
import { createIssueThrottle } from "./sessions/throttle.js";

export function createRuntimeServices({
  projectRoot = process.cwd(),
  github = createGithubClient(),
  config = readRuntimeConfig(),
  frameStore = createFrameStore(),
  sessionRepository = createSessionRepository(),
  sessionEventRepository = createSessionEventRepository(),
  sessionCommandRepository = createSessionCommandRepository(),
  sessionLeaseRepository = createSessionLeaseRepository(),
  sessionFrameRepository = createSessionFrameRepository(),
  sessionManager = null,
  beforeJob = null,
  workerId = `${os.hostname()}:${process.pid}`
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
    primeAt: null,
    bootFrame: {
      enabled: isBootFrameCacheEnabled(),
      prewarmed: false,
      error: null
    }
  };
  const repositoryInfo = {
    frameStoreKind: frameStore.kind,
    sessionRepositoryKind: sessionRepository.kind,
    sessionEventRepositoryKind: sessionEventRepository.kind,
    sessionCommandRepositoryKind: sessionCommandRepository.kind,
    sessionLeaseRepositoryKind: sessionLeaseRepository.kind,
    sessionFrameRepositoryKind: sessionFrameRepository.kind,
    bootFrameCacheEnabled: isBootFrameCacheEnabled(),
    workerId
  };

  const managedSessionManager = sessionManager || createSessionManager({
    projectRoot,
    inactivityMs: config.inactivityMs,
    sessionLeaseRepository,
    workerId,
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
            frameStore,
            sessionManager: managedSessionManager,
            sessionRepository,
            sessionEventRepository,
            sessionLeaseRepository,
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

    if (isBootFrameCacheEnabled() && isBootFramePrewarmEnabled()) {
      try {
        await ensureBootFrameCache(projectRoot);
        recovery.bootFrame.prewarmed = true;
      } catch (error) {
        recovery.bootFrame.error = error instanceof Error ? error.message : String(error);
      }
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
    if (typeof sessionCommandRepository.healthCheck === "function") {
      checks.push(sessionCommandRepository.healthCheck());
    }
    if (typeof sessionLeaseRepository.healthCheck === "function") {
      checks.push(sessionLeaseRepository.healthCheck());
    }
    if (typeof sessionFrameRepository.healthCheck === "function") {
      checks.push(sessionFrameRepository.healthCheck());
    }
    if (typeof frameStore.healthCheck === "function") {
      checks.push(frameStore.healthCheck());
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
    frameStore,
    sessionRepository,
    sessionEventRepository,
    sessionCommandRepository,
    sessionLeaseRepository,
    sessionFrameRepository,
    sessionManager: managedSessionManager,
    repositoryInfo,
    healthCheck,
    prime,
    recovery,
    workerId
  };
}
