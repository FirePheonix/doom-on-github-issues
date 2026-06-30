import { copyFile, readFile, writeFile } from "node:fs/promises";
import { createSession } from "../game.js";
import { ensureEngineAssets, renderEngineFrame } from "../engine.js";
import { inferBaseUrlFromEnv } from "../github/issues.js";
import {
  ensureDataDir,
  getBootFrameCachePath,
  getBootFrameSessionPath,
  getFramePath
} from "../storage.js";

function isEnabled(key, defaultValue = true, env = process.env) {
  const value = env[key];
  if (!value) {
    return defaultValue;
  }
  return value.trim().toLowerCase() !== "false";
}

export function isBootFrameCacheEnabled(env = process.env) {
  return isEnabled("DOOM_BOOT_FRAME_CACHE", true, env);
}

export function isBootFramePrewarmEnabled(env = process.env) {
  return isEnabled("DOOM_BOOT_FRAME_PREWARM", true, env);
}

export async function ensureBootFrameCache(projectRoot) {
  if (!isBootFrameCacheEnabled()) {
    return null;
  }

  const cachePath = getBootFrameCachePath();
  if (!ensureBootFrameCache._ready) {
    ensureBootFrameCache._ready = (async () => {
      await ensureDataDir();

      try {
        await readFile(cachePath);
        return cachePath;
      } catch {}

      await ensureEngineAssets(projectRoot);
      const sessionPath = getBootFrameSessionPath();
      const state = createSession(0);
      state.log = ["Cached boot frame."];
      await writeFile(sessionPath, JSON.stringify(state, null, 2), "utf8");
      await renderEngineFrame(projectRoot, sessionPath, cachePath);
      return cachePath;
    })().catch((error) => {
      ensureBootFrameCache._ready = null;
      throw error;
    });
  }

  return ensureBootFrameCache._ready;
}

export async function publishBootFrame({
  projectRoot,
  issueNumber,
  frameStore,
  sessionFrameRepository = null,
  token = `boot-${Date.now()}`
}) {
  if (!isBootFrameCacheEnabled()) {
    return null;
  }

  const cachePath = await ensureBootFrameCache(projectRoot);
  if (!cachePath) {
    return null;
  }

  const issueFramePath = getFramePath(issueNumber);
  await copyFile(cachePath, issueFramePath);
  await frameStore.publish(issueNumber, token, issueFramePath);

  if (sessionFrameRepository?.append) {
    let publicUrl = "";
    try {
      publicUrl = frameStore.publicUrl({
        issueNumber,
        tick: token,
        baseUrl: inferBaseUrlFromEnv()
      }) || "";
    } catch {}

    await sessionFrameRepository.append(issueNumber, {
      issueNumber,
      tick: 0,
      frameStoreKind: frameStore.kind,
      frameRef: frameStore.kind === "local" ? issueFramePath : (publicUrl || issueFramePath),
      publicUrl,
      mode: "boot-cache",
      cacheToken: token,
      publishedAt: new Date().toISOString()
    });
  }

  return {
    issueFramePath,
    token
  };
}
