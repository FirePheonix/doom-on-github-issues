import { readFile, writeFile } from "node:fs/promises";
import { getFrameMetaPath } from "../storage.js";

export function createFileSessionFrameRepository() {
  const cache = new Map();

  function cloneFrames(frames) {
    return structuredClone(frames);
  }

  async function list(issueNumber) {
    if (cache.has(issueNumber)) {
      return cloneFrames(cache.get(issueNumber));
    }

    try {
      const raw = await readFile(getFrameMetaPath(issueNumber), "utf8");
      const frames = JSON.parse(raw);
      cache.set(issueNumber, frames);
      return cloneFrames(frames);
    } catch {
      return [];
    }
  }

  async function append(issueNumber, frame) {
    const frames = await list(issueNumber);
    frames.push(frame);
    cache.set(issueNumber, cloneFrames(frames));
    await writeFile(getFrameMetaPath(issueNumber), JSON.stringify(frames, null, 2), "utf8");
  }

  async function latest(issueNumber) {
    const frames = await list(issueNumber);
    return frames.at(-1) || null;
  }

  async function count(issueNumber) {
    const frames = await list(issueNumber);
    return frames.length;
  }

  return {
    kind: "file",
    append,
    latest,
    list,
    count
  };
}
