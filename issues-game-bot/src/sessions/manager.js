import { createPersistentEngine } from "../engine.js";

export function createSessionManager({ projectRoot, inactivityMs, onExpire }) {
  const engine = createPersistentEngine(projectRoot);
  const records = new Map();
  const liveSyncWaitMs = Math.max(0, Number(process.env.DOOM_PERSISTENT_SYNC_WAIT_MS || "2000"));

  function cloneState(state) {
    return structuredClone(state);
  }

  function historyKey(history) {
    return JSON.stringify(Array.isArray(history) ? history : []);
  }

  function getRecord(issueNumber) {
    return records.get(issueNumber) || null;
  }

  function clearTimer(record) {
    if (!record?.timer) return;
    clearTimeout(record.timer);
    record.timer = null;
  }

  function shouldArmTimer(status) {
    return status === "active";
  }

  function getRemainingMs(lastActivityAt) {
    if (!lastActivityAt) {
      return inactivityMs;
    }
    const last = Date.parse(lastActivityAt);
    if (!Number.isFinite(last)) {
      return inactivityMs;
    }
    return Math.max(0, inactivityMs - (Date.now() - last));
  }

  function setStatus(issueNumber, status) {
    const record = records.get(issueNumber);
    if (!record) return;
    record.status = status;
    record.lastTouchedAt = new Date().toISOString();
    if (!shouldArmTimer(status)) {
      record.expiresAt = null;
      clearTimer(record);
      return;
    }
    armTimer(issueNumber);
  }

  function armTimer(issueNumber, remainingMs = inactivityMs) {
    const record = records.get(issueNumber);
    if (!record || !shouldArmTimer(record.status)) return;

    clearTimer(record);
    record.expiresAt = new Date(Date.now() + remainingMs).toISOString();
    record.timer = setTimeout(async () => {
      const latest = records.get(issueNumber);
      if (!latest || latest.expiring || !shouldArmTimer(latest.status)) {
        return;
      }

      latest.expiring = true;
      latest.expiresAt = new Date().toISOString();
      try {
        await onExpire?.(issueNumber);
      } finally {
        const current = records.get(issueNumber);
        if (current) {
          current.expiring = false;
        }
      }
    }, Math.max(0, remainingMs));
  }

  function ensureRecord(issueNumber, seed, framePath) {
    const current = records.get(issueNumber);
    if (current) {
      current.seed = seed;
      current.framePath = framePath;
      current.lastTouchedAt = new Date().toISOString();
      return current;
    }

    const record = {
      issueNumber,
      seed,
      framePath,
      status: "active",
      stateSnapshot: null,
      lastTouchedAt: new Date().toISOString(),
      source: "live",
      liveHistory: [],
      liveHistoryKey: historyKey([]),
      liveHistoryLength: 0,
      liveSyncTargetHistory: [],
      liveSyncTargetKey: "",
      liveSyncPromise: null,
      liveSyncError: "",
      expiresAt: null,
      expiring: false,
      timer: null
    };
    records.set(issueNumber, record);
    return record;
  }

  function rememberState(issueNumber, state, framePath = "") {
    const record = ensureRecord(issueNumber, state?.seed, framePath || getRecord(issueNumber)?.framePath || "");
    record.stateSnapshot = cloneState(state);
    record.status = state?.status || record.status;
    record.lastTouchedAt = state?.lastActivityAt || new Date().toISOString();
    if (framePath) {
      record.framePath = framePath;
    }
    if (shouldArmTimer(record.status)) {
      armTimer(issueNumber, getRemainingMs(record.lastTouchedAt));
    } else {
      record.expiresAt = null;
      clearTimer(record);
    }
  }

  function isHistoryPrefix(prefix, history) {
    if (!Array.isArray(prefix) || !Array.isArray(history) || prefix.length > history.length) {
      return false;
    }
    return prefix.every((command, index) => history[index] === command);
  }

  function primeSession(issueNumber, seed, framePath, history = []) {
    if (!engine.isEnabled()) {
      return;
    }

    const record = ensureRecord(issueNumber, seed, framePath);
    const nextHistoryKey = historyKey(history);
    if (record.liveHistoryKey === nextHistoryKey && !record.liveSyncPromise) {
      return;
    }
    if (record.liveSyncPromise && record.liveSyncTargetKey === nextHistoryKey) {
      return;
    }

    const previousTask = record.liveSyncPromise
      ? record.liveSyncPromise.catch(() => {})
      : Promise.resolve();
    const targetHistory = Array.isArray(history) ? [...history] : [];
    const baseHistory = record.liveSyncPromise
      ? [...record.liveSyncTargetHistory]
      : [...record.liveHistory];
    record.liveSyncTargetKey = nextHistoryKey;
    record.liveSyncTargetHistory = targetHistory;
    record.liveSyncError = "";
    const task = previousTask.then(async () => {
      if (targetHistory.length === 0) {
        await engine.startSession(issueNumber, seed, framePath);
        return;
      }

      if (isHistoryPrefix(baseHistory, targetHistory)) {
        const suffix = targetHistory.slice(baseHistory.length);
        if (suffix.length === 0) {
          return;
        }
        await engine.applyCommands(issueNumber, seed, framePath, baseHistory, suffix);
        return;
      }

      await engine.syncHistory(issueNumber, seed, framePath, targetHistory);
    })
      .then(() => {
        const current = records.get(issueNumber);
        if (!current || current.liveSyncPromise !== task) {
          return;
        }
        current.liveHistory = targetHistory;
        current.liveHistoryKey = nextHistoryKey;
        current.liveHistoryLength = targetHistory.length;
        current.liveSyncTargetHistory = [];
        current.liveSyncTargetKey = "";
        current.liveSyncPromise = null;
        current.liveSyncError = "";
        current.source = "live";
      })
      .catch((error) => {
        const current = records.get(issueNumber);
        if (!current || current.liveSyncPromise !== task) {
          return;
        }
        current.liveSyncTargetHistory = [];
        current.liveSyncPromise = null;
        current.liveSyncError = error instanceof Error ? error.message : String(error);
      });
    record.liveSyncPromise = task;
  }

  function getState(issueNumber) {
    const record = records.get(issueNumber);
    if (!record?.stateSnapshot) {
      return null;
    }
    return cloneState(record.stateSnapshot);
  }

  async function waitForLiveSync(record, expectedHistoryKey) {
    if (!record?.liveSyncPromise) {
      return;
    }
    if (record.liveSyncTargetKey !== expectedHistoryKey) {
      return;
    }
    if (liveSyncWaitMs <= 0) {
      return;
    }

    await Promise.race([
      record.liveSyncPromise.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, liveSyncWaitMs))
    ]);
  }

  function updateLiveHistory(record, history) {
    const nextHistory = Array.isArray(history) ? [...history] : [];
    record.liveHistory = nextHistory;
    record.liveHistoryKey = historyKey(nextHistory);
    record.liveHistoryLength = nextHistory.length;
    record.liveSyncError = "";
  }

  async function startSession(issueNumber, seed, framePath) {
    const record = ensureRecord(issueNumber, seed, framePath);
    record.status = "active";
    await engine.startSession(issueNumber, seed, framePath);
    record.source = "live";
    updateLiveHistory(record, []);
    record.liveSyncTargetHistory = [];
    record.liveSyncTargetKey = "";
    record.liveSyncPromise = null;
    armTimer(issueNumber);
  }

  async function restartSession(issueNumber, seed, framePath) {
    const record = ensureRecord(issueNumber, seed, framePath);
    record.status = "active";
    await engine.restartSession(issueNumber, seed, framePath);
    record.source = "live";
    updateLiveHistory(record, []);
    record.liveSyncTargetHistory = [];
    record.liveSyncTargetKey = "";
    record.liveSyncPromise = null;
    armTimer(issueNumber);
  }

  async function applyCommands(issueNumber, seed, framePath, historyPrefix, commands) {
    const record = ensureRecord(issueNumber, seed, framePath);
    record.status = "active";
    const expectedHistoryKey = historyKey(historyPrefix);
    if (record.liveSyncPromise) {
      await waitForLiveSync(record, expectedHistoryKey);
    }
    if (record.liveHistoryKey !== expectedHistoryKey) {
      throw new Error(
        `persistent_engine_not_ready synced_len=${record.liveHistoryLength} expected_len=${Array.isArray(historyPrefix) ? historyPrefix.length : 0}`
      );
    }
    if (!engine.hasSession(issueNumber, framePath)) {
      throw new Error(`persistent_engine_not_ready reason=worker_unavailable issue=${issueNumber}`);
    }
    if (Array.isArray(commands) && commands.length > 0) {
      await engine.applyCommands(issueNumber, seed, framePath, historyPrefix, commands, { requireExistingReady: true });
      const nextHistory = [...(Array.isArray(historyPrefix) ? historyPrefix : []), ...commands];
      updateLiveHistory(record, nextHistory);
    }
    record.source = "live";
    armTimer(issueNumber);
  }

  function restoreSession(state, framePath) {
    const record = ensureRecord(state.issueNumber, state.seed, framePath);
    record.status = state.status;
    record.source = "restored";
    record.stateSnapshot = cloneState(state);
    record.lastTouchedAt = state.lastActivityAt || new Date().toISOString();
    if (!shouldArmTimer(state.status)) {
      record.expiresAt = null;
      clearTimer(record);
      return;
    }
    armTimer(state.issueNumber, getRemainingMs(state.lastActivityAt));
  }

  async function stopSession(issueNumber, status = "stopped") {
    const record = records.get(issueNumber);
    if (record) {
      record.status = status;
      if (record.stateSnapshot) {
        record.stateSnapshot.status = status;
      }
      record.expiresAt = null;
      clearTimer(record);
    }
    await engine.stopSession(issueNumber);
  }

  async function invalidate(issueNumber) {
    const record = records.get(issueNumber);
    if (record) {
      clearTimer(record);
      record.liveHistory = [];
      record.liveSyncTargetHistory = [];
      record.liveSyncPromise = null;
      records.delete(issueNumber);
    }
    await engine.invalidate(issueNumber);
  }

  function get(issueNumber) {
    const record = getRecord(issueNumber);
    if (!record) {
      return { state: "unknown" };
    }

    return {
      state: record.status,
      source: record.source,
      lastTouchedAt: record.lastTouchedAt,
      expiresAt: record.expiresAt,
      expiring: record.expiring,
      framePath: record.framePath,
      tick: record.stateSnapshot?.tick ?? null
    };
  }

  function list() {
    return Array.from(records.values()).map((record) => ({
      issueNumber: record.issueNumber,
      state: record.status,
      source: record.source,
      lastTouchedAt: record.lastTouchedAt,
      expiresAt: record.expiresAt,
      expiring: record.expiring,
      framePath: record.framePath,
      tick: record.stateSnapshot?.tick ?? null
    }));
  }

  return {
    supportsLiveRendering: () => engine.isEnabled(),
    getLiveRenderDisableReason: () => engine.getDisableReason?.() || "",
    primeSession,
    startSession,
    restartSession,
    applyCommands,
    restoreSession,
    stopSession,
    invalidate,
    getState,
    setStatus,
    rememberState,
    get,
    list
  };
}
