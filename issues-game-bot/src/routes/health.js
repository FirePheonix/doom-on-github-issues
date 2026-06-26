import { Router } from "express";

export function createHealthRouter({ github }) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, githubConfigured: Boolean(github) });
  });

  return router;
}

