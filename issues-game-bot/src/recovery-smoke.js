import { createRuntimeServices } from "./runtime.js";

function createFakeSessionRepository(states) {
  return {
    async listByStatus(statuses = []) {
      if (!statuses.length) {
        return structuredClone(states);
      }
      const wanted = new Set(statuses);
      return structuredClone(states.filter((state) => wanted.has(state.status)));
    }
  };
}

function createFakeSessionManager() {
  const restored = [];

  return {
    restoreSession(state, framePath) {
      restored.push({
        issueNumber: state.issueNumber,
        state: state.status,
        framePath
      });
    },
    get(issueNumber) {
      return restored.find((item) => item.issueNumber === issueNumber) || { state: "unknown" };
    },
    list() {
      return structuredClone(restored);
    }
  };
}

function createFakeSessionEventRepository() {
  return {
    async append() {},
    async list() {
      return [];
    },
    async count() {
      return 0;
    }
  };
}

async function main() {
  const sessionRepository = createFakeSessionRepository([
    {
      issueNumber: 11,
      seed: 1011,
      tick: 5,
      status: "active",
      issueState: "open",
      lastActivityAt: new Date().toISOString(),
      history: ["w", "d"],
      log: ["Session restored."]
    },
    {
      issueNumber: 12,
      seed: 1012,
      tick: 2,
      status: "closed",
      issueState: "closed",
      lastActivityAt: new Date().toISOString(),
      history: ["w"],
      log: ["Closed."]
    }
  ]);

  const sessionManager = createFakeSessionManager();
  const services = createRuntimeServices({
    github: null,
    sessionRepository,
    sessionEventRepository: createFakeSessionEventRepository(),
    sessionManager,
    beforeJob: null
  });

  const recovery = await services.prime();

  if (!recovery.primed) {
    throw new Error("Expected runtime recovery to be primed");
  }
  if (recovery.restoredCount !== 1) {
    throw new Error(`Expected one restored active session, got ${recovery.restoredCount}`);
  }
  if (recovery.restoredIssueNumbers[0] !== 11) {
    throw new Error(`Expected issue 11 restored, got ${recovery.restoredIssueNumbers.join(",")}`);
  }

  console.log("recovery-smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
