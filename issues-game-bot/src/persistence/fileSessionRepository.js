import { readFile, writeFile } from "node:fs/promises";
import { getSessionPath } from "../storage.js";

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

  return {
    kind: "file",
    load,
    loadOptional,
    save,
    exists
  };
}
