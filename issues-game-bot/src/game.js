import { createHash } from "node:crypto";

const WORLD_WIDTH = 30;
const WORLD_HEIGHT = 16;
const MAX_HP = 4;
const WIN_KILLS = 12;

const ALLOWED_COMMANDS = new Set([
  "w",
  "a",
  "s",
  "d",
  "fire",
  "enter",
  "help",
  "restart"
]);

const DIRECTIONS = {
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 }
};

function nextRng(seed) {
  return (seed * 1103515245 + 12345) & 0x7fffffff;
}

function rand(state, max) {
  state.rng = nextRng(state.rng);
  return state.rng % max;
}

function buildMap() {
  const map = Array.from({ length: WORLD_HEIGHT }, () => Array.from({ length: WORLD_WIDTH }, () => "."));

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    map[0][x] = "#";
    map[WORLD_HEIGHT - 1][x] = "#";
  }

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    map[y][0] = "#";
    map[y][WORLD_WIDTH - 1] = "#";
  }

  for (let y = 2; y < WORLD_HEIGHT - 2; y += 4) {
    for (let x = 3; x < WORLD_WIDTH - 3; x += 7) {
      map[y][x] = "#";
      if (y + 1 < WORLD_HEIGHT - 1) {
        map[y + 1][x] = "#";
      }
    }
  }

  return map;
}

function isWalkable(map, x, y) {
  if (x < 0 || y < 0 || y >= map.length || x >= map[0].length) {
    return false;
  }
  return map[y][x] !== "#";
}

function spawnDemon(state) {
  const map = state.map;
  for (let tries = 0; tries < 30; tries += 1) {
    const x = 1 + rand(state, WORLD_WIDTH - 2);
    const y = 1 + rand(state, WORLD_HEIGHT - 2);
    if (!isWalkable(map, x, y)) continue;

    const occupied = state.demons.some((d) => d.x === x && d.y === y);
    const onPlayer = state.player.x === x && state.player.y === y;
    if (!occupied && !onPlayer) {
      state.demons.push({ id: state.nextDemonId++, x, y, hp: 1 });
      return;
    }
  }
}

export function createSession(issueNumber) {
  const seed = Number.parseInt(createHash("md5").update(String(issueNumber)).digest("hex").slice(0, 8), 16);
  const state = {
    issueNumber,
    tick: 0,
    status: "running",
    rng: seed,
    nextDemonId: 1,
    kills: 0,
    map: buildMap(),
    player: {
      x: 2,
      y: 2,
      hp: MAX_HP,
      facing: "d"
    },
    demons: [],
    log: ["Doom issue session started. One comment is one turn."],
    commandQueue: []
  };

  for (let i = 0; i < 2; i += 1) {
    spawnDemon(state);
  }
  return state;
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

function movePlayer(state, dir) {
  const vec = DIRECTIONS[dir];
  if (!vec) return;

  const nx = state.player.x + vec.dx;
  const ny = state.player.y + vec.dy;
  state.player.facing = dir;

  if (isWalkable(state.map, nx, ny)) {
    state.player.x = nx;
    state.player.y = ny;
  }
}

function fire(state) {
  const facing = DIRECTIONS[state.player.facing] || DIRECTIONS.d;
  let x = state.player.x + facing.dx;
  let y = state.player.y + facing.dy;

  while (isWalkable(state.map, x, y)) {
    const demon = state.demons.find((d) => d.x === x && d.y === y);
    if (demon) {
      state.demons = state.demons.filter((d) => d.id !== demon.id);
      state.kills += 1;
      state.log.unshift("Direct hit.");
      return;
    }
    x += facing.dx;
    y += facing.dy;
  }

  state.log.unshift("Shot missed.");
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

  if (["w", "a", "s", "d"].includes(next)) {
    movePlayer(state, next);
    return;
  }

  if (next === "fire" || next === "enter") {
    fire(state);
  }
}

function moveDemonTowardPlayer(state, demon) {
  const options = [
    { dx: Math.sign(state.player.x - demon.x), dy: 0 },
    { dx: 0, dy: Math.sign(state.player.y - demon.y) }
  ];

  for (const option of options) {
    if (option.dx === 0 && option.dy === 0) continue;
    const nx = demon.x + option.dx;
    const ny = demon.y + option.dy;

    if (!isWalkable(state.map, nx, ny)) continue;

    const occupied = state.demons.some((d) => d.id !== demon.id && d.x === nx && d.y === ny);
    if (!occupied) {
      demon.x = nx;
      demon.y = ny;
      return;
    }
  }
}

function updateDemons(state) {
  let damagedThisTick = false;
  for (const demon of state.demons) {
    moveDemonTowardPlayer(state, demon);

    if (!damagedThisTick && demon.x === state.player.x && demon.y === state.player.y) {
      state.player.hp -= 1;
      damagedThisTick = true;
      state.log.unshift("Demon clawed you.");
    }
  }
}

function maybeSpawnDemon(state) {
  if (state.tick % 4 === 0 && state.demons.length < 5) {
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

export function renderFrame(state) {
  const grid = state.map.map((row) => row.slice());

  for (const demon of state.demons) {
    grid[demon.y][demon.x] = "d";
  }

  grid[state.player.y][state.player.x] = "@";

  const legend = [
    `tick=${state.tick} hp=${state.player.hp} kills=${state.kills}/${WIN_KILLS} status=${state.status}`,
    "commands: w a s d fire enter restart help"
  ];

  const frame = grid.map((row) => row.join("")).join("\n");
  const logs = state.log.map((line) => `- ${line}`).join("\n");

  return `${legend.join("\n")}\n\n${frame}\n\n${logs}`;
}
