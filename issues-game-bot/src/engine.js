import { spawn } from "node:child_process";
import path from "node:path";

function getPythonBin() {
  return process.env.PYTHON_BIN || "python";
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
  let chain = Promise.resolve();
  const pending = new Map();
  const requestTimeoutMs = Number(process.env.DOOM_SESSION_WORKER_TIMEOUT_MS || "20000");

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
    rejectPending(error);
    onExit?.(error);
  });

  child.on("close", (code) => {
    closed = true;
    const error = new Error(
      `doom_session_worker exited for issue ${issueNumber} with code ${code}: ${stderrTail.trim()}`
    );
    rejectPending(error);
    onExit?.(error);
  });

  function request(type, payload = {}) {
    if (closed) {
      return Promise.reject(new Error("session_worker_closed"));
    }

    const id = nextId++;
    const message = JSON.stringify({ id, type, ...payload }) + "\n";

    const run = () => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`session_worker_timeout type=${type} issue=${issueNumber} after ${requestTimeoutMs}ms`));
      }, requestTimeoutMs);

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
    isClosed: () => closed
  };
}

export function createPersistentEngine(projectRoot) {
  const workers = new Map();

  async function spawnOrReuse(issueNumber, seed, framePath, history = []) {
    const current = workers.get(issueNumber);
    if (current && !current.worker.isClosed() && current.framePath === framePath) {
      return current.worker;
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
    await worker.request("snapshot");
    if (history.length > 0) {
      await worker.request("step", { commands: history });
    }
    return worker;
  }

  async function startSession(issueNumber, seed, framePath) {
    await spawnOrReuse(issueNumber, seed, framePath, []);
  }

  async function restartSession(issueNumber, seed, framePath) {
    await stopSession(issueNumber);
    await spawnOrReuse(issueNumber, seed, framePath, []);
  }

  async function applyCommands(issueNumber, seed, framePath, historyPrefix, commands) {
    if (!Array.isArray(commands) || commands.length === 0) {
      return;
    }
    const worker = await spawnOrReuse(issueNumber, seed, framePath, historyPrefix);
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

  return {
    startSession,
    restartSession,
    applyCommands,
    stopSession,
    invalidate
  };
}
