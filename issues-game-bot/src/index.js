import { createServer } from "./server.js";

const port = Number(process.env.PORT || 3000);
const app = createServer();
await app.locals.runtimeServices?.prime?.();

app.listen(port, () => {
  console.log(`issues-game-bot listening on :${port}`);
});
