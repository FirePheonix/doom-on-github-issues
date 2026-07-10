import { copyFile, readFile, writeFile } from "node:fs/promises";
import { getRedisJson, isRedisConfigured, setRedisJson } from "../cache/redis.js";
import { createSession, stepSession } from "../game.js";
import { ensureEngineAssets, renderEngineFrame } from "../engine.js";
import {
  ensureDataDir,
  getMenuFrameCachePath,
  getMenuFrameSessionPath
} from "../storage.js";
import { ensureBootFrameCache, isBootFrameCacheEnabled } from "../bootFrame/cache.js";

const MENU_FRAME_SPECS = [
  { key: "enter", history: ["enter"] },
  { key: "enter-enter", history: ["enter", "enter"] },
  { key: "enter-enter-enter", history: ["enter", "enter", "enter"] },
  { key: "enter-enter-s", history: ["enter", "enter", "s"] },
  { key: "enter-enter-s-enter", history: ["enter", "enter", "s", "enter"] },
  { key: "enter-enter-s-s", history: ["enter", "enter", "s", "s"] },
  { key: "enter-enter-s-s-enter", history: ["enter", "enter", "s", "s", "enter"] }
];

function isEnabled(key, defaultValue = true, env = process.env) {
  const value = env[key];
  if (!value) {
    return defaultValue;
  }
  return value.trim().toLowerCase() !== "false";
}

export function isMenuFrameCacheEnabled(env = process.env) {
  return isEnabled("DOOM_MENU_FRAME_CACHE", true, env);
}

export function isMenuFramePrewarmEnabled(env = process.env) {
  return isEnabled("DOOM_MENU_FRAME_PREWARM", true, env);
}

function getMenuFrameRedisKey(key) {
  return `doom:menu-frame:url:${key}`;
}

function matchesHistory(history, expected) {
  if (!Array.isArray(history) || history.length !== expected.length) {
    return false;
  }
  return expected.every((command, index) => history[index] === command);
}

function findMenuFrameSpec(history) {
  return MENU_FRAME_SPECS.find((spec) => matchesHistory(history, spec.history)) || null;
}

async function buildMenuFrame(projectRoot, spec) {
  await ensureDataDir();
  await ensureEngineAssets(projectRoot);

  const cachePath = getMenuFrameCachePath(spec.key);
  try {
    await readFile(cachePath);
    return cachePath;
  } catch {}

  const sessionPath = getMenuFrameSessionPath(spec.key);
  const state = createSession(0);
  for (const command of spec.history) {
    stepSession(state, command);
  }

  await writeFile(sessionPath, JSON.stringify(state, null, 2), "utf8");
  await renderEngineFrame(projectRoot, sessionPath, cachePath);
  return cachePath;
}

async function getIndexedSharedUrl(key) {
  if (getIndexedSharedUrl._cache?.has(key)) {
    return getIndexedSharedUrl._cache.get(key);
  }

  if (!isRedisConfigured()) {
    return "";
  }

  const payload = await getRedisJson(getMenuFrameRedisKey(key));
  const url = payload?.url || "";
  if (!getIndexedSharedUrl._cache) {
    getIndexedSharedUrl._cache = new Map();
  }
  if (url) {
    getIndexedSharedUrl._cache.set(key, url);
  }
  return url;
}

async function setIndexedSharedUrl(key, url) {
  if (!url) {
    return;
  }

  if (!getIndexedSharedUrl._cache) {
    getIndexedSharedUrl._cache = new Map();
  }
  getIndexedSharedUrl._cache.set(key, url);

  if (!isRedisConfigured()) {
    return;
  }

  await setRedisJson(getMenuFrameRedisKey(key), {
    key,
    url,
    updatedAt: new Date().toISOString()
  });
}

async function ensureSharedMenuFrame(projectRoot, spec, frameStore) {
  if (typeof frameStore?.sharedUrl !== "function" || typeof frameStore?.publishShared !== "function") {
    return "";
  }

  const indexed = await getIndexedSharedUrl(spec.key);
  if (indexed) {
    return indexed;
  }

  const cachePath = await ensureMenuFrameCache(projectRoot, spec.key);
  if (!cachePath) {
    return "";
  }

  await frameStore.publishShared(spec.key, cachePath);
  const url = frameStore.sharedUrl(spec.key) || "";
  await setIndexedSharedUrl(spec.key, url);
  return url;
}

export async function ensureMenuFrameCache(projectRoot, key) {
  const spec = MENU_FRAME_SPECS.find((entry) => entry.key === key);
  if (!spec || !isMenuFrameCacheEnabled()) {
    return null;
  }

  if (!ensureMenuFrameCache._ready) {
    ensureMenuFrameCache._ready = new Map();
  }

  if (!ensureMenuFrameCache._ready.has(spec.key)) {
    const task = buildMenuFrame(projectRoot, spec).catch((error) => {
      ensureMenuFrameCache._ready.delete(spec.key);
      throw error;
    });
    ensureMenuFrameCache._ready.set(spec.key, task);
  }

  return ensureMenuFrameCache._ready.get(spec.key);
}

export async function primeMenuFrameCache(projectRoot, frameStore = null) {
  if (!isMenuFrameCacheEnabled() || !isMenuFramePrewarmEnabled()) {
    return [];
  }

  const warmed = [];
  for (const spec of MENU_FRAME_SPECS) {
    await ensureMenuFrameCache(projectRoot, spec.key);
    if (frameStore) {
      await ensureSharedMenuFrame(projectRoot, spec, frameStore);
    }
    warmed.push(spec.key);
  }
  return warmed;
}

export async function resolveCachedMenuFrame(projectRoot, history, frameStore = null) {
  if (Array.isArray(history) && history.length === 0 && isBootFrameCacheEnabled()) {
    return {
      kind: "boot-cache",
      path: await ensureBootFrameCache(projectRoot)
    };
  }

  const spec = findMenuFrameSpec(history);
  if (!spec) {
    return null;
  }

  const cachePath = await ensureMenuFrameCache(projectRoot, spec.key);
  if (!cachePath) {
    return null;
  }

  const sharedUrl = frameStore
    ? await ensureSharedMenuFrame(projectRoot, spec, frameStore)
    : "";

  return {
    kind: "menu-cache",
    path: cachePath,
    key: spec.key,
    history: [...spec.history],
    sharedUrl
  };
}

export async function publishCachedMenuFrame({
  projectRoot,
  issueNumber,
  history,
  framePath,
  frameStore
}) {
  const cached = await resolveCachedMenuFrame(projectRoot, history, frameStore);
  if (!cached?.path) {
    return null;
  }

  await copyFile(cached.path, framePath);
  if (!cached.sharedUrl) {
    await frameStore.publish(issueNumber, Array.isArray(history) ? history.length : 0, framePath);
  }
  return cached;
}

export function listMenuFrameSpecs() {
  return MENU_FRAME_SPECS.map((spec) => ({
    key: spec.key,
    history: [...spec.history]
  }));
}
