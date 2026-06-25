import { createHash } from "node:crypto";

const ALLOWED_COMMANDS = new Set(["w", "a", "s", "d", "fire", "enter", "help", "restart"]);

export function createSession(issueNumber) {
  const seed = Number.parseInt(
    createHash("sha1").update(String(issueNumber)).digest("hex").slice(0, 8),
    16
  );

  return {
    issueNumber,
    seed,
    tick: 0,
    status: "running",
    history: [],
    log: ["Session started. Real Doom engine frame pipeline enabled."]
  };
}

export function normalizeCommand(input) {
  if (!input) return null;
  const token = input.trim().toLowerCase().split(/\s+/)[0];
  if (token === "space") return "fire";
  return ALLOWED_COMMANDS.has(token) ? token : null;
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
    state.log.unshift("Commands: w a s d fire enter restart help");
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: command };
  }

  if (command === "restart") {
    restartInPlace(state);
    state.log = state.log.slice(0, 8);
    return { state, acceptedCommand: command };
  }

  state.history.push(command);
  state.tick += 1;
  state.log.unshift(`Applied command: ${command}`);
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
    commands: "w=forward a=turn-left s=back d=turn-right fire/enter=shoot",
    renderer: "vizdoom"
  };
}
