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
    r: "d",
    shoot: "fire",
    space: "fire",
    escape: "esc"
  };
  const normalized = aliases[token] || token;
  return ALLOWED_COMMANDS.has(normalized) ? normalized : null;
}

export function splitCommandLines(input) {
  if (!input) {
    return [];
  }

  return String(input)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function expandCompactCommandLine(line) {
  const normalized = String(line || "").trim().toLowerCase();
  if (!normalized || /\s/.test(normalized) || normalized.length <= 1) {
    return [line];
  }

  if (/^[wasdr]+$/.test(normalized)) {
    return normalized.split("");
  }

  return [line];
}

export function expandCommentCommands(input) {
  return splitCommandLines(input).flatMap((line) => expandCompactCommandLine(line));
}

export function parseCommentCommands(input) {
  return expandCommentCommands(input).map((rawCommand) => ({
    rawCommand,
    acceptedCommand: normalizeCommand(rawCommand)
  }));
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

function applySingleCommand(state, rawCommand) {
  const command = normalizeCommand(rawCommand);
  const tickBefore = state.tick;

  if (rawCommand && !command) {
    state.log.unshift(`Unknown command: ${rawCommand.trim().split(/\s+/)[0]}`);
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: null, appliedCommands: [], restarted: false, tickBefore, tickAfter: state.tick };
  }

  if (!command) {
    return { state, acceptedCommand: null, appliedCommands: [], restarted: false, tickBefore, tickAfter: state.tick };
  }

  if (command === "help") {
    state.log.unshift("Commands: w a s d fire enter exit restart help");
    state.lastActivityAt = new Date().toISOString();
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: command, appliedCommands: [], restarted: false, tickBefore, tickAfter: state.tick };
  }

  if (command === "restart") {
    restartInPlace(state);
    state.lastActivityAt = new Date().toISOString();
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: command, appliedCommands: [], restarted: true, tickBefore, tickAfter: state.tick };
  }

  if (command === "exit" || command === "quit") {
    state.status = "exited";
    state.lastActivityAt = new Date().toISOString();
    state.log.unshift("Game exited. Comment `restart` to start a new run.");
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: command, appliedCommands: [], restarted: false, tickBefore, tickAfter: state.tick };
  }

  const repeat = getCommandRepeat(rawCommand, command);
  const appliedCommands = [];
  for (let i = 0; i < repeat; i += 1) {
    state.history.push(command);
    appliedCommands.push(command);
  }
  state.tick += repeat;
  state.lastActivityAt = new Date().toISOString();
  state.inactivityNotifiedAt = null;
  state.log.unshift(`Applied command: ${command}${repeat > 1 ? ` x${repeat}` : ""}`);
  state.log = state.log.slice(0, 8);
  return { state, acceptedCommand: command, appliedCommands, restarted: false, tickBefore, tickAfter: state.tick };
}

export function stepSession(state, rawCommand) {
  const lines = expandCommentCommands(rawCommand);
  if (lines.length <= 1) {
    const single = applySingleCommand(state, rawCommand);
    return {
      ...single,
      acceptedCommands: single.acceptedCommand ? [single.acceptedCommand] : [],
      commandOutcomes: [{ rawCommand, ...single }]
    };
  }

  const acceptedCommands = [];
  const appliedCommands = [];
  const commandOutcomes = [];
  let acceptedCommand = null;
  let restarted = false;

  for (const line of lines) {
    const outcome = applySingleCommand(state, line);
    commandOutcomes.push({ rawCommand: line, ...outcome });
    if (outcome.acceptedCommand) {
      acceptedCommands.push(outcome.acceptedCommand);
      acceptedCommand = acceptedCommand || outcome.acceptedCommand;
    }
    if (outcome.appliedCommands.length > 0) {
      appliedCommands.push(...outcome.appliedCommands);
    }
    if (outcome.restarted) {
      restarted = true;
    }
    if (state.status === "exited" || state.status === "closed") {
      break;
    }
  }

  return {
    state,
    acceptedCommand,
    acceptedCommands,
    appliedCommands,
    restarted,
    commandOutcomes,
    tickBefore: commandOutcomes[0]?.tickBefore ?? state.tick,
    tickAfter: state.tick
  };
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
