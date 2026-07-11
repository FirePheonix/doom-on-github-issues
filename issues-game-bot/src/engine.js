import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

function getPythonBin() {
  return process.env.PYTHON_BIN || "python";
}

function isTruthy(value) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value || "").trim().toLowerCase());
}

function isFalsy(value) {
  return ["0", "false", "no", "off", "disabled"].includes(String(value || "").trim().toLowerCase());
}

function readPersistentEngineConfig() {
  const rawMode = String(process.env.DOOM_PERSISTENT_ENGINE || "auto").trim().toLowerCase();

  if (isTruthy(rawMode)) {
    return {
      enabled: true,
      reason: ""
    };
  }

  if (isFalsy(rawMode)) {
    return {
      enabled: false,
      reason: `env_disabled value=${rawMode || "false"}`
    };
  }

  return {
    enabled: true,
    reason: ""
  };
}

function runProcess(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";

    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ out, err });
        return;
      }
      reject(new Error(`Command failed (${cmd} ${args.join(" ")}): ${err || out}`));
    });
  });
}

export async function ensureEngineAssets(projectRoot) {
  if (ensureEngineAssets._ready) {
    return ensureEngineAssets._ready;
  }

  const assetsRoot = path.join(projectRoot, "scripts", "assets");
  const requiredAssets = [
    path.join(assetsRoot, "doom1.wad"),
    path.join(assetsRoot, "basic.wad"),
    path.join(assetsRoot, "basic.cfg"),
    path.join(assetsRoot, "defend_the_center.wad"),
    path.join(assetsRoot, "defend_the_center.cfg")
  ];
  const assetsPresent = await Promise.all(requiredAssets.map((assetPath) => access(assetPath).then(() => true, () => false)));
  if (assetsPresent.every(Boolean)) {
    ensureEngineAssets._ready = Promise.resolve({ out: "assets-present", err: "" });
    return ensureEngineAssets._ready;
  }

  const scriptsDir = path.join(projectRoot, "scripts");
  const cmd = getPythonBin();
  ensureEngineAssets._ready = runProcess(cmd, ["fetch_doom_assets.py"], scriptsDir);
  return ensureEngineAssets._ready;
}

export async function renderEngineFrame(projectRoot, sessionPath, outputPath) {
  const scriptsDir = path.join(projectRoot, "scripts");
  const cmd = getPythonBin();
  await runProcess(cmd, ["doom_worker.py", sessionPath, outputPath], scriptsDir);
}

function createPersistentSessionWorker({ projectRoot, issueNumber, framePath, seed, onExit }) {
  const scriptsDir = path.join(projectRoot, "scripts");
  const cmd = getPythonBin();
  const child = spawn(cmd, ["doom_session_worker.py", framePath, String(seed)], {
    cwd: scriptsDir,
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stderrTail = "";
  let stdoutBuffer = "";
  let nextId = 1;
  let closed = false;
  let ready = false;
  let chain = Promise.resolve();
  const pending = new Map();
  const requestTimeoutMs = Number(process.env.DOOM_SESSION_WORKER_TIMEOUT_MS || "20000");
  const startupTimeoutMs = Number(
    process.env.DOOM_SESSION_WORKER_STARTUP_TIMEOUT_MS ||
    process.env.DOOM_SESSION_WORKER_TIMEOUT_MS ||
    "4000"
  );
  let resolveReady = null;
  let rejectReady = null;
  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  function markReady() {
    if (ready) {
      return;
    }
    ready = true;
    resolveReady?.();
  }

  function failReady(error) {
    if (ready) {
      return;
    }
    rejectReady?.(error);
  }

  function rejectPending(error) {
    for (const item of pending.values()) {
      item.reject(error);
    }
    pending.clear();
  }

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      if (text === "READY") {
        markReady();
        continue;
      }
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        continue;
      }

      if (!payload?.id) continue;
      const item = pending.get(payload.id);
      if (!item) continue;
      pending.delete(payload.id);
      if (payload.ok) {
        item.resolve(payload);
      } else {
        item.reject(new Error(payload.error || "session_worker_request_failed"));
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrTail += chunk.toString();
    if (stderrTail.length > 8000) {
      stderrTail = stderrTail.slice(-8000);
    }
  });

  child.on("error", (error) => {
    closed = true;
    failReady(error);
    rejectPending(error);
    onExit?.(error);
  });

  child.on("close", (code) => {
    closed = true;
    const error = new Error(
      `doom_session_worker exited for issue ${issueNumber} with code ${code}: ${stderrTail.trim()}`
    );
    failReady(error);
    rejectPending(error);
    onExit?.(error);
  });

  function waitUntilReady(timeoutMs = startupTimeoutMs) {
    if (ready) {
      return Promise.resolve();
    }

    return Promise.race([
      readyPromise,
      new Promise((_, reject) => {
        const timeout = setTimeout(() => {
          const stderrInfo = stderrTail.trim() ? ` stderr=${JSON.stringify(stderrTail.trim())}` : "";
          reject(new Error(`session_worker_ready_timeout issue=${issueNumber} after ${timeoutMs}ms${stderrInfo}`));
        }, timeoutMs);

        readyPromise.then(
          () => clearTimeout(timeout),
          () => clearTimeout(timeout)
        );
      })
    ]);
  }

  function request(type, payload = {}, options = {}) {
    if (closed) {
      return Promise.reject(new Error("session_worker_closed"));
    }

    const id = nextId++;
    const message = JSON.stringify({ id, type, ...payload }) + "\n";
    const timeoutMs = Number(options.timeoutMs || requestTimeoutMs);

    const run = () => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        const stderrInfo = stderrTail.trim() ? ` stderr=${JSON.stringify(stderrTail.trim())}` : "";
        reject(new Error(`session_worker_timeout type=${type} issue=${issueNumber} after ${timeoutMs}ms${stderrInfo}`));
      }, timeoutMs);

      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      child.stdin.write(message, "utf8", (error) => {
        if (error) {
          const item = pending.get(id);
          pending.delete(id);
          if (item) {
            item.reject(error);
          } else {
            clearTimeout(timeout);
            reject(error);
          }
        }
      });
    });

    chain = chain.then(run, run);
    return chain;
  }

  async function shutdown() {
    if (closed) return;
    try {
      await Promise.race([
        request("shutdown"),
        new Promise((resolve) => setTimeout(resolve, 1000))
      ]);
    } catch {
      // best effort
    }
    child.kill();
  }

  return {
    request,
    shutdown,
    isClosed: () => closed,
    isReady: () => ready,
    waitUntilReady,
    startupTimeoutMs
  };
}

export function createPersistentEngine(projectRoot) {
  const config = readPersistentEngineConfig();
  if (!config.enabled) {
    return {
      isEnabled: () => false,
      getDisableReason: () => config.reason,
      startSession: async () => {},
      restartSession: async () => {},
      applyCommands: async () => {},
      hasSession: () => false,
      stopSession: async () => {},
      invalidate: async () => {}
    };
  }

  const workers = new Map();

  async function spawnOrReuse(issueNumber, seed, framePath, history = [], options = {}) {
    const requireExistingReady = options.requireExistingReady === true;
    const current = workers.get(issueNumber);
    if (current && !current.worker.isClosed() && current.framePath === framePath) {
      return current.worker;
    }

    if (requireExistingReady) {
      throw new Error(`persistent_engine_not_ready reason=worker_unavailable issue=${issueNumber}`);
    }

    if (current) {
      await current.worker.shutdown();
      workers.delete(issueNumber);
    }

    await ensureEngineAssets(projectRoot);
    const worker = createPersistentSessionWorker({
      projectRoot,
      issueNumber,
      framePath,
      seed,
      onExit: () => {
        const latest = workers.get(issueNumber);
        if (latest?.worker === worker) {
          workers.delete(issueNumber);
        }
      }
    });

    workers.set(issueNumber, { worker, framePath });
    try {
      await worker.waitUntilReady(worker.startupTimeoutMs);
    } catch (error) {
      await worker.shutdown().catch(() => {});
      const latest = workers.get(issueNumber);
      if (latest?.worker === worker) {
        workers.delete(issueNumber);
      }
      throw error;
    }
    return worker;
  }

  async function startSession(issueNumber, seed, framePath) {
    await spawnOrReuse(issueNumber, seed, framePath, []);
  }

  async function restartSession(issueNumber, seed, framePath) {
    await stopSession(issueNumber);
    await startSession(issueNumber, seed, framePath);
  }

  async function syncHistory(issueNumber, seed, framePath, history = []) {
    await stopSession(issueNumber);
    const worker = await spawnOrReuse(issueNumber, seed, framePath, []);
    if (Array.isArray(history) && history.length > 0) {
      await worker.request("step", { commands: history }, { timeoutMs: worker.startupTimeoutMs });
    }
  }

  async function applyCommands(issueNumber, seed, framePath, historyPrefix, commands, options = {}) {
    if (!Array.isArray(commands) || commands.length === 0) {
      return;
    }
    const worker = await spawnOrReuse(issueNumber, seed, framePath, historyPrefix, options);
    await worker.request("step", { commands });
  }

  async function stopSession(issueNumber) {
    const current = workers.get(issueNumber);
    if (!current) return;
    workers.delete(issueNumber);
    await current.worker.shutdown();
  }

  async function invalidate(issueNumber) {
    await stopSession(issueNumber);
  }

  function hasSession(issueNumber, framePath = "") {
    const current = workers.get(issueNumber);
    if (!current || current.worker.isClosed()) {
      return false;
    }
    if (framePath && current.framePath !== framePath) {
      return false;
    }
    return current.worker.isReady();
  }

  return {
    isEnabled: () => true,
    getDisableReason: () => "",
    startSession,
    restartSession,
    syncHistory,
    applyCommands,
    hasSession,
    stopSession,
    invalidate
  };
}
