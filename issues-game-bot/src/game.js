import { createHash } from "node:crypto";

const ALLOWED_COMMANDS = new Set([
  "w",
  "a",
  "s",
  "d",
  "up",
  "down",
  "left",
  "right",
  "fire",
  "shoot",
  "enter",
  "esc",
  "escape",
  "exit",
  "quit",
  "help",
  "restart"
]);

export function createSession(issueNumber) {
  const seed = Number.parseInt(
    createHash("sha1").update(String(issueNumber)).digest("hex").slice(0, 8),
    16
  );

  return {
    issueNumber,
    seed,
    tick: 0,
    status: "active",
    issueState: "open",
    lastActivityAt: new Date().toISOString(),
    inactivityNotifiedAt: null,
    pauseNoticeNotifiedAt: null,
    history: [],
    log: ["Session started. Real Doom engine frame pipeline enabled."]
  };
}

export function normalizeCommand(input) {
  if (!input) return null;
  const token = input.trim().toLowerCase().split(/\s+/)[0];
  const aliases = {
    up: "w",
    down: "s",
    left: "a",
    right: "d",
    shoot: "fire",
    space: "fire",
    escape: "esc"
  };
  const normalized = aliases[token] || token;
  return ALLOWED_COMMANDS.has(normalized) ? normalized : null;
}

function getCommandRepeat(input, command) {
  const parts = (input || "").trim().toLowerCase().split(/\s+/);
  const requested = Number(parts[1]);
  if (Number.isFinite(requested) && requested > 0) {
    return Math.min(12, Math.floor(requested));
  }

  if (command === "a" || command === "d") return 4;
  if (command === "fire") return 4;
  return 1;
}

function restartInPlace(state) {
  const fresh = createSession(state.issueNumber);
  Object.assign(state, fresh);
  state.log.unshift("Session restarted.");
}

export function stepSession(state, rawCommand) {
  const command = normalizeCommand(rawCommand);

  if (rawCommand && !command) {
    state.log.unshift(`Unknown command: ${rawCommand.trim().split(/\s+/)[0]}`);
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: null };
  }

  if (!command) {
    return { state, acceptedCommand: null };
  }

  if (command === "help") {
    state.log.unshift("Commands: w a s d fire enter exit restart help");
    state.lastActivityAt = new Date().toISOString();
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: command };
  }

  if (command === "restart") {
    restartInPlace(state);
    state.lastActivityAt = new Date().toISOString();
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: command };
  }

  if (command === "exit" || command === "quit") {
    state.status = "exited";
    state.lastActivityAt = new Date().toISOString();
    state.log.unshift("Game exited. Comment `restart` to start a new run.");
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: command };
  }

  const repeat = getCommandRepeat(rawCommand, command);
  for (let i = 0; i < repeat; i += 1) {
    state.history.push(command);
  }
  state.tick += repeat;
  state.lastActivityAt = new Date().toISOString();
  state.inactivityNotifiedAt = null;
  state.log.unshift(`Applied command: ${command}${repeat > 1 ? ` x${repeat}` : ""}`);
  state.log = state.log.slice(0, 8);
  return { state, acceptedCommand: command };
}

export function summarizeState(state) {
  return {
    tick: state.tick,
    hp: "engine-managed",
    kills: "engine-managed",
    targetKills: "n/a",
    status: state.status,
    commands: "menu: w/s/a/d arrows, enter select, esc back | game: w/a/s/d + fire | exit | restart",
    renderer: "doomgeneric"
  };
}
