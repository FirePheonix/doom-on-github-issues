import { Router } from "express";

export function createDebugRouter({ jobStatusStore, sessionManager }) {
  const router = Router();

  router.get("/debug/issues/:issueNumber", (req, res) => {
    const issueNumber = Number(req.params.issueNumber);
    if (!Number.isFinite(issueNumber)) {
      res.status(400).json({ ok: false, error: "invalid_issue_number" });
      return;
    }

    res.json({
      ok: true,
      issueNumber,
      status: jobStatusStore.get(issueNumber),
      session: sessionManager?.get(issueNumber) || { state: "unknown" }
    });
  });

  router.get("/debug/sessions", (_req, res) => {
    res.json({
      ok: true,
      sessions: sessionManager?.list() || []
    });
  });

  return router;
}
