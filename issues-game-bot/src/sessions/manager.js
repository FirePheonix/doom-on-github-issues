import { createPersistentEngine } from "../engine.js";

export function createSessionManager({ projectRoot, inactivityMs, onExpire }) {
  const engine = createPersistentEngine(projectRoot);
  const records = new Map();

  function cloneState(state) {
    return structuredClone(state);
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

  function armTimer(issueNumber) {
    const record = records.get(issueNumber);
    if (!record || !shouldArmTimer(record.status)) return;

    clearTimer(record);
    record.expiresAt = new Date(Date.now() + inactivityMs).toISOString();
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
    }, Math.max(0, inactivityMs));
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
    record.lastTouchedAt = new Date().toISOString();
    if (framePath) {
      record.framePath = framePath;
    }
  }

  function getState(issueNumber) {
    const record = records.get(issueNumber);
    if (!record?.stateSnapshot) {
      return null;
    }
    return cloneState(record.stateSnapshot);
  }

  async function startSession(issueNumber, seed, framePath) {
    const record = ensureRecord(issueNumber, seed, framePath);
    record.status = "active";
    await engine.startSession(issueNumber, seed, framePath);
    armTimer(issueNumber);
  }

  async function restartSession(issueNumber, seed, framePath) {
    const record = ensureRecord(issueNumber, seed, framePath);
    record.status = "active";
    await engine.restartSession(issueNumber, seed, framePath);
    armTimer(issueNumber);
  }

  async function applyCommands(issueNumber, seed, framePath, historyPrefix, commands) {
    const record = ensureRecord(issueNumber, seed, framePath);
    record.status = "active";
    if (Array.isArray(commands) && commands.length > 0) {
      await engine.applyCommands(issueNumber, seed, framePath, historyPrefix, commands);
    }
    armTimer(issueNumber);
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
      lastTouchedAt: record.lastTouchedAt,
      expiresAt: record.expiresAt,
      expiring: record.expiring,
      framePath: record.framePath,
      tick: record.stateSnapshot?.tick ?? null
    }));
  }

  return {
    startSession,
    restartSession,
    applyCommands,
    stopSession,
    invalidate,
    getState,
    setStatus,
    rememberState,
    get,
    list
  };
}
