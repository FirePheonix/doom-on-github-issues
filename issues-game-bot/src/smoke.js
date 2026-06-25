import { createSession, stepSession, summarizeState } from "./game.js";
import { renderPngFrame } from "./renderer.js";
import { writeFileSync } from "node:fs";

const state = createSession(42);
for (const cmd of ["w", "d", "w", "fire", "a", "w", "fire"]) {
  stepSession(state, cmd);
}

const png = renderPngFrame(state);
writeFileSync("smoke-frame.png", png);
console.log(summarizeState(state));
