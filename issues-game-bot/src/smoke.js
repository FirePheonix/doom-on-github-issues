import { createSession, renderFrame, stepSession } from "./game.js";

const state = createSession(42);

for (const cmd of ["d", "d", "fire", "w", "fire"]) {
  stepSession(state, cmd);
}

console.log(renderFrame(state));
