import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const sessionsDir = path.join(dataDir, "sessions");
const framesDir = path.join(dataDir, "frames");

export function getSessionPath(issueNumber) {
  return path.join(sessionsDir, `${issueNumber}.json`);
}

export function getFramePath(issueNumber) {
  return path.join(framesDir, `${issueNumber}.png`);
}

export async function ensureDataDir() {
  await mkdir(sessionsDir, { recursive: true });
  await mkdir(framesDir, { recursive: true });
}

export async function loadSession(issueNumber) {
  const filePath = getSessionPath(issueNumber);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function saveSession(issueNumber, state) {
  const filePath = getSessionPath(issueNumber);
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

export async function saveFrame(issueNumber, pngBuffer) {
  await writeFile(getFramePath(issueNumber), pngBuffer);
}

export async function hasSession(issueNumber) {
  try {
    await readFile(getSessionPath(issueNumber), "utf8");
    return true;
  } catch {
    return false;
  }
}

