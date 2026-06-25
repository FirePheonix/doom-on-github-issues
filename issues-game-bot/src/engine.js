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
