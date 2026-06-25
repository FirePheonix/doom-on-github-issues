import { createHash } from "node:crypto";

const MAP_W = 24;
const MAP_H = 24;
const MAX_HP = 6;
const WIN_KILLS = 15;
const MOVE_STEP = 0.28;
const TURN_STEP = 0.26;

const ALLOWED_COMMANDS = new Set(["w", "a", "s", "d", "fire", "enter", "help", "restart"]);

function nextRng(seed) {
  return (seed * 1664525 + 1013904223) >>> 0;
}

function rand(state, max) {
  state.rng = nextRng(state.rng);
  return state.rng % max;
}

function buildMap() {
  const map = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => 0));

  for (let x = 0; x < MAP_W; x += 1) {
    map[0][x] = 1;
    map[MAP_H - 1][x] = 1;
  }
  for (let y = 0; y < MAP_H; y += 1) {
    map[y][0] = 1;
    map[y][MAP_W - 1] = 1;
  }

  for (let y = 2; y < MAP_H - 2; y += 4) {
    for (let x = 2; x < MAP_W - 2; x += 6) {
      map[y][x] = 1;
      if (x + 1 < MAP_W - 1) map[y][x + 1] = 1;
      if (y + 1 < MAP_H - 1 && (x / 2) % 2 === 0) map[y + 1][x] = 1;
    }
  }

  return map;
}

function isWalkable(map, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= MAP_W || yi >= MAP_H) return false;
  return map[yi][xi] === 0;
}

function movePlayer(state, dx, dy) {
  const px = state.player.x;
  const py = state.player.y;
  const nx = px + dx;
  const ny = py + dy;

  if (isWalkable(state.map, nx, py)) state.player.x = nx;
  if (isWalkable(state.map, state.player.x, ny)) state.player.y = ny;
}

function spawnDemon(state) {
  for (let tries = 0; tries < 120; tries += 1) {
    const x = 1.5 + rand(state, MAP_W - 3);
    const y = 1.5 + rand(state, MAP_H - 3);
    if (!isWalkable(state.map, x, y)) continue;

    const farEnough = Math.hypot(x - state.player.x, y - state.player.y) > 5;
    const occupied = state.demons.some((d) => Math.hypot(d.x - x, d.y - y) < 0.8);
    if (farEnough && !occupied) {
      state.demons.push({ id: state.nextDemonId++, x, y, hp: 1 });
      return;
    }
  }
}

export function createSession(issueNumber) {
  const seed = Number.parseInt(createHash("sha1").update(String(issueNumber)).digest("hex").slice(0, 8), 16);
  const state = {
    issueNumber,
    tick: 0,
    status: "running",
    rng: seed,
    nextDemonId: 1,
    kills: 0,
    map: buildMap(),
    player: {
      x: 3.5,
      y: 3.5,
      angle: 0,
      hp: MAX_HP
    },
    demons: [],
    log: ["Session started. Real frame pipeline enabled."],
    commandQueue: []
  };

  for (let i = 0; i < 4; i += 1) spawnDemon(state);
  return state;
}

export function normalizeCommand(input) {
  if (!input) return null;
  const token = input.trim().toLowerCase().split(/\s+/)[0];
  if (token === "space") return "fire";
  return ALLOWED_COMMANDS.has(token) ? token : null;
}

function fire(state) {
  const coneHalf = 0.14;
  const maxDistance = 10;
  let best = null;

  for (const demon of state.demons) {
    const dx = demon.x - state.player.x;
    const dy = demon.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDistance) continue;

    const ang = Math.atan2(dy, dx);
    let delta = ang - state.player.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    if (Math.abs(delta) <= coneHalf) {
      if (!best || dist < best.dist) best = { id: demon.id, dist };
    }
  }

  if (best) {
    state.demons = state.demons.filter((d) => d.id !== best.id);
    state.kills += 1;
    state.log.unshift("Direct hit.");
    return;
  }

  state.log.unshift("Shot missed.");
}

function restartInPlace(state) {
  const fresh = createSession(state.issueNumber);
  Object.assign(state, fresh);
  state.log.unshift("Session restarted.");
}

function processCommand(state, command, rawCommand) {
  if (rawCommand && !command) {
    state.log.unshift(`Unknown command: ${rawCommand.trim().split(/\s+/)[0]}`);
    return;
  }
  if (!command) return;

  state.commandQueue.push(command);
  const next = state.commandQueue.shift();
  if (!next) return;

  if (next === "help") {
    state.log.unshift("Commands: w a s d fire enter restart help");
    return;
  }

  if (next === "restart") {
    restartInPlace(state);
    return;
  }

  if (state.status !== "running") {
    state.log.unshift("Session ended. Use restart.");
    return;
  }

  if (next === "a") {
    state.player.angle -= TURN_STEP;
    return;
  }
  if (next === "d") {
    state.player.angle += TURN_STEP;
    return;
  }
  if (next === "w") {
    movePlayer(state, Math.cos(state.player.angle) * MOVE_STEP, Math.sin(state.player.angle) * MOVE_STEP);
    return;
  }
  if (next === "s") {
    movePlayer(state, -Math.cos(state.player.angle) * MOVE_STEP, -Math.sin(state.player.angle) * MOVE_STEP);
    return;
  }
  if (next === "fire" || next === "enter") {
    fire(state);
  }
}

function updateDemons(state) {
  let damaged = false;

  for (const demon of state.demons) {
    const dx = state.player.x - demon.x;
    const dy = state.player.y - demon.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.8) {
      const step = 0.12;
      const nx = demon.x + (dx / dist) * step;
      const ny = demon.y + (dy / dist) * step;
      if (isWalkable(state.map, nx, demon.y)) demon.x = nx;
      if (isWalkable(state.map, demon.x, ny)) demon.y = ny;
    }

    if (!damaged && Math.hypot(demon.x - state.player.x, demon.y - state.player.y) < 0.85) {
      state.player.hp -= 1;
      damaged = true;
      state.log.unshift("Demon clawed you.");
    }
  }
}

function maybeSpawnDemon(state) {
  if (state.tick % 3 === 0 && state.demons.length < 7) {
    spawnDemon(state);
  }
}

function updateStatus(state) {
  if (state.player.hp <= 0) {
    state.status = "lost";
    state.log.unshift("You died.");
    return;
  }
  if (state.kills >= WIN_KILLS) {
    state.status = "won";
    state.log.unshift("Area cleared.");
  }
}

export function stepSession(state, rawCommand) {
  const command = normalizeCommand(rawCommand);
  processCommand(state, command, rawCommand);

  if (state.status === "running") {
    state.tick += 1;
    updateDemons(state);
    maybeSpawnDemon(state);
    updateStatus(state);
  }

  state.log = state.log.slice(0, 6);
  return { state, acceptedCommand: command };
}

export function summarizeState(state) {
  return {
    tick: state.tick,
    hp: state.player.hp,
    kills: state.kills,
    targetKills: WIN_KILLS,
    status: state.status,
    commands: "w=forward a=turn-left s=back d=turn-right fire/enter=shoot"
  };
}
