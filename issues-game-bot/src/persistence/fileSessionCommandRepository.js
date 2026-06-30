import { readFile, writeFile } from "node:fs/promises";
import { getCommandLogPath } from "../storage.js";

export function createFileSessionCommandRepository() {
  const cache = new Map();

  function cloneCommands(commands) {
    return structuredClone(commands);
  }

  async function list(issueNumber) {
    if (cache.has(issueNumber)) {
      return cloneCommands(cache.get(issueNumber));
    }

    try {
      const raw = await readFile(getCommandLogPath(issueNumber), "utf8");
      const commands = JSON.parse(raw);
      cache.set(issueNumber, commands);
      return cloneCommands(commands);
    } catch {
      return [];
    }
  }

  async function append(issueNumber, command) {
    await appendMany(issueNumber, [command]);
  }

  async function appendMany(issueNumber, commands) {
    if (!Array.isArray(commands) || commands.length === 0) {
      return;
    }

    const existing = await list(issueNumber);
    const merged = existing.concat(commands);
    cache.set(issueNumber, cloneCommands(merged));
    await writeFile(getCommandLogPath(issueNumber), JSON.stringify(merged, null, 2), "utf8");
  }

  async function count(issueNumber) {
    const commands = await list(issueNumber);
    return commands.length;
  }

  return {
    kind: "file",
    append,
    appendMany,
    list,
    count
  };
}
