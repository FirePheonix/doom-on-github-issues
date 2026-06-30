import { readFile, writeFile } from "node:fs/promises";
import { getEventLogPath } from "../storage.js";

export function createFileSessionEventRepository() {
  const cache = new Map();

  function cloneEvents(events) {
    return structuredClone(events);
  }

  async function list(issueNumber) {
    if (cache.has(issueNumber)) {
      return cloneEvents(cache.get(issueNumber));
    }

    try {
      const raw = await readFile(getEventLogPath(issueNumber), "utf8");
      const events = JSON.parse(raw);
      cache.set(issueNumber, events);
      return cloneEvents(events);
    } catch {
      return [];
    }
  }

  async function append(issueNumber, event) {
    const events = await list(issueNumber);
    events.push(event);
    cache.set(issueNumber, cloneEvents(events));
    await writeFile(getEventLogPath(issueNumber), JSON.stringify(events, null, 2), "utf8");
  }

  async function count(issueNumber) {
    const events = await list(issueNumber);
    return events.length;
  }

  return {
    kind: "file",
    append,
    list,
    count
  };
}
