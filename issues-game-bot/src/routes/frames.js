import { Router } from "express";
import { ensureDataDir, getFramePath } from "../storage.js";

export function createFramesRouter() {
  const router = Router();

  router.get("/frames/:issueNumber.png", async (req, res) => {
    try {
      await ensureDataDir();
      const issueNumber = Number(req.params.issueNumber);
      if (!Number.isFinite(issueNumber)) {
        res.status(400).json({ ok: false, error: "invalid_issue_number" });
        return;
      }

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.sendFile(getFramePath(issueNumber));
    } catch {
      res.status(404).json({ ok: false, error: "frame_not_found" });
    }
  });

  return router;
}

