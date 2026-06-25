import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sessionsDir = path.resolve(process.cwd(), "data", "sessions");

function getSessionPath(issueNumber) {
  return path.join(sessionsDir, `${issueNumber}.json`);
}

export async function ensureDataDir() {
  await mkdir(sessionsDir, { recursive: true });
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

export async function hasSession(issueNumber) {
  try {
    await readFile(getSessionPath(issueNumber), "utf8");
    return true;
  } catch {
    return false;
  }
}
