import { stat } from "node:fs/promises";
import path from "node:path";
import { createPersistentEngine } from "./engine.js";
import { ensureDataDir, getFramePath } from "./storage.js";

async function assertFrameExists(framePath, label) {
  const info = await stat(framePath);
  if (!info.isFile() || info.size <= 0) {
    throw new Error(`Expected non-empty frame after ${label}`);
  }
  return info;
}

async function main() {
  process.env.DOOM_ENGINE = "doomgeneric";
  process.env.DOOM_PERSISTENT_ENGINE = "true";
  process.env.DOOM_SESSION_WORKER_TIMEOUT_MS = process.env.DOOM_SESSION_WORKER_TIMEOUT_MS || "20000";
  process.env.DOOM_SESSION_WORKER_STARTUP_TIMEOUT_MS = process.env.DOOM_SESSION_WORKER_STARTUP_TIMEOUT_MS || "20000";

  const binaryOverride = process.env.DOOMGENERIC_SESSION_BINARY || "";
  if (!binaryOverride) {
    throw new Error("Set DOOMGENERIC_SESSION_BINARY to a local doomgeneric_session_worker binary before running this smoke test.");
  }

  const projectRoot = path.resolve(process.cwd());
  const engine = createPersistentEngine(projectRoot);
  const issueNumber = 9001;
  const seed = 1337;

  await ensureDataDir();
  const framePath = getFramePath(issueNumber);

  await engine.startSession(issueNumber, seed, framePath);
  const first = await assertFrameExists(framePath, "startSession");

  await engine.applyCommands(issueNumber, seed, framePath, [], ["enter"]);
  const second = await assertFrameExists(framePath, "first enter");
  if (second.mtimeMs < first.mtimeMs) {
    throw new Error("Frame timestamp did not advance after first enter");
  }

  await engine.applyCommands(issueNumber, seed, framePath, ["enter"], ["enter"]);
  const third = await assertFrameExists(framePath, "second enter");
  if (third.mtimeMs < second.mtimeMs) {
    throw new Error("Frame timestamp did not advance after second enter");
  }

  await engine.applyCommands(issueNumber, seed, framePath, ["enter", "enter"], ["enter"]);
  const fourth = await assertFrameExists(framePath, "third enter");
  if (fourth.mtimeMs < third.mtimeMs) {
    throw new Error("Frame timestamp did not advance after third enter");
  }

  await engine.applyCommands(issueNumber, seed, framePath, ["enter", "enter", "enter"], ["d"]);
  const fifth = await assertFrameExists(framePath, "live step after cached menu path");
  if (fifth.mtimeMs < fourth.mtimeMs) {
    throw new Error("Frame timestamp did not advance after live step");
  }

  await engine.stopSession(issueNumber);
  console.log("persistent-engine-smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
