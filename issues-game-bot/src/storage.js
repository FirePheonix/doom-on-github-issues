import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const sessionsDir = path.join(dataDir, "sessions");
const framesDir = path.join(dataDir, "frames");
const eventsDir = path.join(dataDir, "events");

export function getSessionPath(issueNumber) {
  return path.join(sessionsDir, `${issueNumber}.json`);
}

export function getFramePath(issueNumber) {
  return path.join(framesDir, `${issueNumber}.png`);
}

export function getEventLogPath(issueNumber) {
  return path.join(eventsDir, `${issueNumber}.json`);
}

export function getSessionsDir() {
  return sessionsDir;
}

export async function ensureDataDir() {
  await mkdir(sessionsDir, { recursive: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(eventsDir, { recursive: true });
}

export async function saveFrame(issueNumber, pngBuffer) {
  await writeFile(getFramePath(issueNumber), pngBuffer);
}

