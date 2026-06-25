import { createServer } from "./server.js";

const port = Number(process.env.PORT || 3000);
const app = createServer();

app.listen(port, () => {
  console.log(`issues-game-bot listening on :${port}`);
});
