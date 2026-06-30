import { createPersistentEngine } from "../engine.js";

export function createSessionManager({ projectRoot, inactivityMs, onExpire, sessionLeaseRepository = null, workerId = `worker:${process.pid}` }) {
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

  function buildLease(record) {
    return {
      issueNumber: record.issueNumber,
      workerId,
      status: record.status,
      source: record.source,
      framePath: record.framePath || null,
      tick: record.stateSnapshot?.tick ?? null,
      lastTouchedAt: record.lastTouchedAt || null,
      leaseExpiresAt: record.expiresAt || null,
      updatedAt: new Date().toISOString()
    };
  }

  async function syncLease(record) {
    if (!sessionLeaseRepository || !record) return;
    await sessionLeaseRepository.upsert(record.issueNumber, buildLease(record));
  }

  function syncLeaseLater(record) {
    if (!sessionLeaseRepository || !record) return;
    void syncLease(record).catch((error) => {
      console.error(`Failed to persist lease for issue ${record.issueNumber}`, error);
    });
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
      syncLeaseLater(record);
      return;
    }
    armTimer(issueNumber);
    syncLeaseLater(record);
  }

  function armTimer(issueNumber, remainingMs = inactivityMs) {
    const record = records.get(issueNumber);
    if (!record || !shouldArmTimer(record.status)) return;

    clearTimer(record);
    record.expiresAt = new Date(Date.now() + remainingMs).toISOString();
    syncLeaseLater(record);
    record.timer = setTimeout(async () => {
      const latest = records.get(issueNumber);
      if (!latest || latest.expiring || !shouldArmTimer(latest.status)) {
        return;
      }

      latest.expiring = true;
      latest.expiresAt = new Date().toISOString();
      syncLeaseLater(latest);
      try {
        await onExpire?.(issueNumber);
      } finally {
        const current = records.get(issueNumber);
        if (current) {
          current.expiring = false;
          syncLeaseLater(current);
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
    syncLeaseLater(record);
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
    record.source = "live";
    armTimer(issueNumber);
    await syncLease(record);
  }

  async function restartSession(issueNumber, seed, framePath) {
    const record = ensureRecord(issueNumber, seed, framePath);
    record.status = "active";
    await engine.restartSession(issueNumber, seed, framePath);
    record.source = "live";
    armTimer(issueNumber);
    await syncLease(record);
  }

  async function applyCommands(issueNumber, seed, framePath, historyPrefix, commands) {
    const record = ensureRecord(issueNumber, seed, framePath);
    record.status = "active";
    if (Array.isArray(commands) && commands.length > 0) {
      await engine.applyCommands(issueNumber, seed, framePath, historyPrefix, commands);
    }
    record.source = "live";
    armTimer(issueNumber);
    await syncLease(record);
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
      syncLeaseLater(record);
      return;
    }
    armTimer(state.issueNumber, getRemainingMs(state.lastActivityAt));
    syncLeaseLater(record);
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
    await syncLease(record);
  }

  async function invalidate(issueNumber) {
    const record = records.get(issueNumber);
    if (record) {
      clearTimer(record);
      records.delete(issueNumber);
    }
    await engine.invalidate(issueNumber);
    if (sessionLeaseRepository) {
      await sessionLeaseRepository.remove(issueNumber);
    }
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
