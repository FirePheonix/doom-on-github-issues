import { createSession, stepSession, summarizeState } from "./game.js";

const state = createSession(42);
for (const cmd of ["w", "d", "w", "fire", "a", "w", "fire"]) {
  stepSession(state, cmd);
}

console.log(summarizeState(state));
console.log(state.log.slice(0, 3));
