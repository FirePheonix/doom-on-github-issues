import { readFile, writeFile } from "node:fs/promises";
import { getSessionPath } from "../storage.js";

export function createFileSessionRepository() {
  async function load(issueNumber) {
    const raw = await readFile(getSessionPath(issueNumber), "utf8");
    return JSON.parse(raw);
  }

  async function save(issueNumber, state) {
    await writeFile(getSessionPath(issueNumber), JSON.stringify(state, null, 2), "utf8");
  }

  async function exists(issueNumber) {
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
    save,
    exists
  };
}
