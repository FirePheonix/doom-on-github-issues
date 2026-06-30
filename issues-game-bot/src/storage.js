import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve(process.cwd(), "data");
const sessionsDir = path.join(dataDir, "sessions");
const framesDir = path.join(dataDir, "frames");
const eventsDir = path.join(dataDir, "events");
const commandsDir = path.join(dataDir, "commands");
const leasesDir = path.join(dataDir, "leases");
const frameMetaDir = path.join(dataDir, "frame-meta");
const cacheDir = path.join(dataDir, "cache");

export function getSessionPath(issueNumber) {
  return path.join(sessionsDir, `${issueNumber}.json`);
}

export function getFramePath(issueNumber) {
  return path.join(framesDir, `${issueNumber}.png`);
}

export function getEventLogPath(issueNumber) {
  return path.join(eventsDir, `${issueNumber}.json`);
}

export function getCommandLogPath(issueNumber) {
  return path.join(commandsDir, `${issueNumber}.json`);
}

export function getLeasePath(issueNumber) {
  return path.join(leasesDir, `${issueNumber}.json`);
}

export function getFrameMetaPath(issueNumber) {
  return path.join(frameMetaDir, `${issueNumber}.json`);
}

export function getBootFrameCachePath() {
  return path.join(cacheDir, "boot-frame.png");
}

export function getBootFrameSessionPath() {
  return path.join(cacheDir, "boot-frame-session.json");
}

export function getSessionsDir() {
  return sessionsDir;
}

export function getLeasesDir() {
  return leasesDir;
}

export async function ensureDataDir() {
  await mkdir(sessionsDir, { recursive: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(eventsDir, { recursive: true });
  await mkdir(commandsDir, { recursive: true });
  await mkdir(leasesDir, { recursive: true });
  await mkdir(frameMetaDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
}

export async function saveFrame(issueNumber, pngBuffer) {
  await writeFile(getFramePath(issueNumber), pngBuffer);
}

