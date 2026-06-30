import { Router } from "express";

export function createDebugRouter({ jobStatusStore, sessionManager, sessionEventRepository }) {
  const router = Router();

  router.get("/debug/issues/:issueNumber", async (req, res) => {
    const issueNumber = Number(req.params.issueNumber);
    if (!Number.isFinite(issueNumber)) {
      res.status(400).json({ ok: false, error: "invalid_issue_number" });
      return;
    }

    const eventCount = sessionEventRepository?.count
      ? await sessionEventRepository.count(issueNumber)
      : 0;

    res.json({
      ok: true,
      issueNumber,
      status: jobStatusStore.get(issueNumber),
      session: sessionManager?.get(issueNumber) || { state: "unknown" },
      eventCount
    });
  });

  router.get("/debug/sessions", (_req, res) => {
    res.json({
      ok: true,
      sessions: sessionManager?.list() || []
    });
  });

  router.get("/debug/issues/:issueNumber/events", async (req, res) => {
    const issueNumber = Number(req.params.issueNumber);
    if (!Number.isFinite(issueNumber)) {
      res.status(400).json({ ok: false, error: "invalid_issue_number" });
      return;
    }

    res.json({
      ok: true,
      issueNumber,
      events: sessionEventRepository?.list ? await sessionEventRepository.list(issueNumber) : []
    });
  });

  return router;
}
