import { Router } from "express";

export function createHealthRouter({ github, runtimeServices }) {
  const router = Router();

  router.get("/health", async (_req, res) => {
    try {
      const runtime = runtimeServices?.healthCheck
        ? await runtimeServices.healthCheck()
        : { ok: true };
      res.json({
        ok: true,
        githubConfigured: Boolean(github),
        runtime
      });
    } catch (error) {
      res.status(503).json({
        ok: false,
        githubConfigured: Boolean(github),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
