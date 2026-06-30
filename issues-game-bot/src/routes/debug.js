import { Router } from "express";

export function createDebugRouter({
  jobStatusStore,
  sessionManager,
  sessionEventRepository,
  sessionCommandRepository,
  sessionLeaseRepository,
  sessionFrameRepository,
  runtimeServices
}) {
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
    const commandCount = sessionCommandRepository?.count
      ? await sessionCommandRepository.count(issueNumber)
      : 0;
    const frameCount = sessionFrameRepository?.count
      ? await sessionFrameRepository.count(issueNumber)
      : 0;
    const lease = sessionLeaseRepository?.get
      ? await sessionLeaseRepository.get(issueNumber)
      : null;

    res.json({
      ok: true,
      issueNumber,
      status: jobStatusStore.get(issueNumber),
      session: sessionManager?.get(issueNumber) || { state: "unknown" },
      eventCount,
      commandCount,
      frameCount,
      lease
    });
  });

  router.get("/debug/sessions", (_req, res) => {
    res.json({
      ok: true,
      sessions: sessionManager?.list() || []
    });
  });

  router.get("/debug/runtime", (_req, res) => {
    res.json({
      ok: true,
      recovery: runtimeServices?.recovery || { primed: false },
      repositoryInfo: runtimeServices?.repositoryInfo || {}
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

  router.get("/debug/issues/:issueNumber/commands", async (req, res) => {
    const issueNumber = Number(req.params.issueNumber);
    if (!Number.isFinite(issueNumber)) {
      res.status(400).json({ ok: false, error: "invalid_issue_number" });
      return;
    }

    res.json({
      ok: true,
      issueNumber,
      commands: sessionCommandRepository?.list ? await sessionCommandRepository.list(issueNumber) : []
    });
  });

  router.get("/debug/issues/:issueNumber/frames", async (req, res) => {
    const issueNumber = Number(req.params.issueNumber);
    if (!Number.isFinite(issueNumber)) {
      res.status(400).json({ ok: false, error: "invalid_issue_number" });
      return;
    }

    res.json({
      ok: true,
      issueNumber,
      frames: sessionFrameRepository?.list ? await sessionFrameRepository.list(issueNumber) : []
    });
  });

  router.get("/debug/leases", async (_req, res) => {
    res.json({
      ok: true,
      leases: sessionLeaseRepository?.list ? await sessionLeaseRepository.list() : []
    });
  });

  return router;
}
