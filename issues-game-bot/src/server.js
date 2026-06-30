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
    sessionRepository,
    sessionEventRepository,
    sessionManager,
    prime,
    recovery
  } = createRuntimeServices(options);

  app.locals.runtimeServices = {
    projectRoot,
    config,
    lockStore,
    jobStatusStore,
    jobQueue,
    throttle,
    sessionRepository,
    sessionEventRepository,
    sessionManager,
    prime,
    recovery
  };

  app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  }));

  app.use(createHealthRouter({ github }));
  app.use(createDebugRouter({
    jobStatusStore,
    sessionManager,
    sessionEventRepository,
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
    sessionRepository,
    sessionEventRepository,
    sessionManager
  }));

  return app;
}
