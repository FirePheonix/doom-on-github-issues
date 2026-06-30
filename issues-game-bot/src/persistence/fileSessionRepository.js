import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSessionPath, getSessionsDir } from "../storage.js";

export function createFileSessionRepository() {
  const cache = new Map();

  function cloneState(state) {
    return structuredClone(state);
  }

  async function load(issueNumber) {
    if (cache.has(issueNumber)) {
      return cloneState(cache.get(issueNumber));
    }

    const raw = await readFile(getSessionPath(issueNumber), "utf8");
    const state = JSON.parse(raw);
    cache.set(issueNumber, state);
    return cloneState(state);
  }

  async function loadOptional(issueNumber) {
    try {
      return await load(issueNumber);
    } catch {
      return null;
    }
  }

  async function save(issueNumber, state) {
    cache.set(issueNumber, cloneState(state));
    await writeFile(getSessionPath(issueNumber), JSON.stringify(state, null, 2), "utf8");
  }

  async function exists(issueNumber) {
    if (cache.has(issueNumber)) {
      return true;
    }

    try {
      await readFile(getSessionPath(issueNumber), "utf8");
      return true;
    } catch {
      return false;
    }
  }

  async function listByStatus(statuses = []) {
    let files = [];
    try {
      files = await readdir(getSessionsDir());
    } catch {
      return [];
    }

    const wanted = statuses.length > 0 ? new Set(statuses) : null;
    const results = [];

    for (const file of files) {
      if (path.extname(file) !== ".json") continue;
      const issueNumber = Number(path.basename(file, ".json"));
      if (!Number.isFinite(issueNumber)) continue;
      const state = await loadOptional(issueNumber);
      if (!state) continue;
      if (wanted && !wanted.has(state.status)) continue;
      results.push(state);
    }

    return results;
  }

  return {
    kind: "file",
    load,
    loadOptional,
    save,
    exists,
    listByStatus
  };
}
