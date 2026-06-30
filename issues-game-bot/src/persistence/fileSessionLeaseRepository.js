import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getLeasePath, getLeasesDir } from "../storage.js";

export function createFileSessionLeaseRepository() {
  const cache = new Map();

  function cloneLease(lease) {
    return structuredClone(lease);
  }

  async function get(issueNumber) {
    if (cache.has(issueNumber)) {
      return cloneLease(cache.get(issueNumber));
    }

    try {
      const raw = await readFile(getLeasePath(issueNumber), "utf8");
      const lease = JSON.parse(raw);
      cache.set(issueNumber, lease);
      return cloneLease(lease);
    } catch {
      return null;
    }
  }

  async function upsert(issueNumber, lease) {
    cache.set(issueNumber, cloneLease(lease));
    await writeFile(getLeasePath(issueNumber), JSON.stringify(lease, null, 2), "utf8");
  }

  async function remove(issueNumber) {
    cache.delete(issueNumber);
    try {
      await rm(getLeasePath(issueNumber), { force: true });
    } catch {}
  }

  async function list() {
    let files = [];
    try {
      files = await readdir(getLeasesDir());
    } catch {
      return [];
    }

    const leases = [];
    for (const file of files) {
      if (path.extname(file) !== ".json") continue;
      const issueNumber = Number(path.basename(file, ".json"));
      if (!Number.isFinite(issueNumber)) continue;
      const lease = await get(issueNumber);
      if (lease) {
        leases.push(lease);
      }
    }

    return leases.sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
  }

  return {
    kind: "file",
    get,
    upsert,
    remove,
    list
  };
}
