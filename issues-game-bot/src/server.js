import express from "express";
import { readRuntimeConfig } from "./config/env.js";
import { createGithubClient } from "./github/client.js";
import { createJobQueue } from "./jobs/queue.js";
import { createLockStore } from "./jobs/locks.js";
import { createJobStatusStore } from "./jobs/status.js";
import { createIssueThrottle } from "./sessions/throttle.js";
import { createPersistentEngine, ensureEngineAssets } from "./engine.js";
import { createDebugRouter } from "./routes/debug.js";
import { createFramesRouter } from "./routes/frames.js";
import { createHealthRouter } from "./routes/health.js";
import { createWebhookRouter } from "./routes/webhook.js";

export function createServer() {
  const projectRoot = process.cwd();
  const app = express();
  const github = createGithubClient();
  const config = readRuntimeConfig();
  const engine = createPersistentEngine(projectRoot);
  const lockStore = createLockStore();
  const jobStatusStore = createJobStatusStore();
  const jobQueue = createJobQueue({
    statusStore: jobStatusStore,
    beforeJob: () => ensureEngineAssets(projectRoot)
  });
  const throttle = createIssueThrottle(config.issueCooldownMs);

  app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  }));

  app.use(createHealthRouter({ github }));
  app.use(createDebugRouter({ jobStatusStore }));
  app.use(createFramesRouter());
  app.use(createWebhookRouter({
    github,
    projectRoot,
    config,
    lockStore,
    jobQueue,
    throttle,
    engine
  }));

  return app;
}
