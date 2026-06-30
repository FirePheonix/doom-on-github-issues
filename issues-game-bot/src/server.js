import express from "express";
import { createDebugRouter } from "./routes/debug.js";
import { createFramesRouter } from "./routes/frames.js";
import { createHealthRouter } from "./routes/health.js";
import { createWebhookRouter } from "./routes/webhook.js";
import { createRuntimeServices } from "./runtime.js";

export function createServer(options = {}) {
  const app = express();
  const {
    github,
    projectRoot,
    config,
    lockStore,
    jobStatusStore,
    jobQueue,
    throttle,
    frameStore,
    sessionRepository,
    sessionEventRepository,
    sessionCommandRepository,
    sessionLeaseRepository,
    sessionFrameRepository,
    sessionManager,
    repositoryInfo,
    prime,
    recovery,
    workerId
  } = createRuntimeServices(options);

  app.locals.runtimeServices = {
    projectRoot,
    config,
    lockStore,
    jobStatusStore,
    jobQueue,
    throttle,
    frameStore,
    sessionRepository,
    sessionEventRepository,
    sessionCommandRepository,
    sessionLeaseRepository,
    sessionFrameRepository,
    sessionManager,
    repositoryInfo,
    prime,
    recovery,
    workerId
  };

  app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  }));

  app.use(createHealthRouter({ github, runtimeServices: app.locals.runtimeServices }));
  app.use(createDebugRouter({
    jobStatusStore,
    sessionManager,
    sessionEventRepository,
    sessionCommandRepository,
    sessionLeaseRepository,
    sessionFrameRepository,
    runtimeServices: app.locals.runtimeServices
  }));
  app.use(createFramesRouter());
  app.use(createWebhookRouter({
    github,
    projectRoot,
    config,
    lockStore,
    jobQueue,
    throttle,
    frameStore,
    sessionRepository,
    sessionEventRepository,
    sessionCommandRepository,
    sessionLeaseRepository,
    sessionFrameRepository,
    sessionManager
  }));

  return app;
}
