import { Router } from "express";
import { publishBootFrame } from "../bootFrame/cache.js";
import { readGithubTarget } from "../config/env.js";
import { getIssueNumber, isExpectedRepo, verifySignature } from "../github/webhooks.js";
import {
  applyIssueCommentCommand,
  closeIssueSession,
  reopenIssueSession,
  startIssueSession
} from "../sessions/lifecycle.js";
import { updateIssueLoadingView } from "../views/loadingView.js";

export function createWebhookRouter({
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
}) {
  const router = Router();

  router.post("/webhook", async (req, res) => {
    try {
      const signature = req.get("x-hub-signature-256");
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
      if (!verifySignature(config.webhookSecret, rawBody, signature)) {
        res.status(401).json({ ok: false, error: "invalid_signature" });
        return;
      }

      if (!github) {
        res.status(500).json({ ok: false, error: "missing_github_token" });
        return;
      }

      const { owner, repo } = readGithubTarget();
      const event = req.get("x-github-event");
      const payload = req.body;

      if (!isExpectedRepo(payload, owner, repo)) {
        res.status(403).json({ ok: false, error: "unexpected_repository" });
        return;
      }

      if (event === "issues" && payload?.action === "opened") {
        await handleIssueOpened({ github, owner, repo, payload, req, res, projectRoot, lockStore, jobQueue, config, frameStore, sessionRepository, sessionEventRepository, sessionCommandRepository, sessionFrameRepository, sessionManager });
        return;
      }

      if (event === "issues" && payload?.action === "closed") {
        await handleIssueClosed({ github, owner, repo, payload, res, lockStore, jobQueue, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager });
        return;
      }

      if (event === "issues" && payload?.action === "reopened") {
        await handleIssueReopened({ github, owner, repo, payload, res, lockStore, jobQueue, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager });
        return;
      }

      if (event === "issue_comment" && payload?.action === "created") {
        await handleIssueComment({
          github,
          owner,
          repo,
          payload,
          req,
          res,
          projectRoot,
          lockStore,
          jobQueue,
          throttle,
          config,
          frameStore,
          sessionRepository,
          sessionEventRepository,
          sessionCommandRepository,
          sessionLeaseRepository,
          sessionFrameRepository,
          sessionManager
        });
        return;
      }

      res.json({ ok: true, ignored: `${event || "unknown"}` });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  return router;
}

async function handleIssueOpened({ github, owner, repo, payload, req, res, projectRoot, lockStore, jobQueue, config, frameStore, sessionRepository, sessionEventRepository, sessionCommandRepository, sessionFrameRepository, sessionManager }) {
  const issueNumber = getIssueNumber(payload);
  if (!issueNumber) {
    res.status(200).json({ ok: true, ignored: "missing_issue_number" });
    return;
  }

  const originalBody = payload.issue.body || "";
  let loadingImageUrl = "";
  try {
    const published = await publishBootFrame({
      projectRoot,
      issueNumber,
      frameStore,
      sessionFrameRepository
    });
    if (published) {
      loadingImageUrl = frameStore.publicUrl({
        issueNumber,
        tick: published.token,
        req
      });
    }
  } catch (error) {
    console.error(`Failed to publish cached boot frame for issue ${issueNumber}`, error);
  }

  await updateIssueLoadingView(github, owner, repo, issueNumber, originalBody, loadingImageUrl);

  jobQueue.schedule(issueNumber, async () => {
    await lockStore.withIssueLock(issueNumber, async () => {
      await startIssueSession({ github, owner, repo, issueNumber, originalBody, req, projectRoot, frameStore, sessionRepository, sessionEventRepository, sessionCommandRepository, sessionFrameRepository, sessionManager });
    });
  }, config.bootDelayMs);

  res.status(202).json({ ok: true, accepted: "issues.opened", issueNumber });
}

async function handleIssueClosed({ github, owner, repo, payload, res, lockStore, jobQueue, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager }) {
  const issueNumber = getIssueNumber(payload);
  if (!issueNumber) {
    res.status(200).json({ ok: true, ignored: "missing_issue_number" });
    return;
  }

  jobQueue.schedule(issueNumber, async () => {
    await lockStore.withIssueLock(issueNumber, async () => {
      await closeIssueSession({ github, owner, repo, issueNumber, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager });
    });
  });

  res.status(202).json({ ok: true, accepted: "issues.closed", issueNumber });
}

async function handleIssueReopened({ github, owner, repo, payload, res, lockStore, jobQueue, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager }) {
  const issueNumber = getIssueNumber(payload);
  if (!issueNumber) {
    res.status(200).json({ ok: true, ignored: "missing_issue_number" });
    return;
  }

  jobQueue.schedule(issueNumber, async () => {
    await lockStore.withIssueLock(issueNumber, async () => {
      await reopenIssueSession({ github, owner, repo, issueNumber, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager });
    });
  });

  res.status(202).json({ ok: true, accepted: "issues.reopened", issueNumber });
}

async function handleIssueComment({
  github,
  owner,
  repo,
  payload,
  req,
  res,
  projectRoot,
  lockStore,
  jobQueue,
  throttle,
  config,
  frameStore,
  sessionRepository,
  sessionEventRepository,
  sessionCommandRepository,
  sessionLeaseRepository,
  sessionFrameRepository,
  sessionManager
}) {
  const issueNumber = getIssueNumber(payload);
  if (!issueNumber) {
    res.status(200).json({ ok: true, ignored: "missing_issue_number" });
    return;
  }

  if (throttle.shouldThrottle(issueNumber)) {
    res.status(200).json({ ok: true, ignored: "issue_cooldown" });
    return;
  }

  const commentBody = payload.comment?.body || "";
  if (commentBody.trim().length === 0) {
    res.status(200).json({ ok: true, ignored: "empty_comment" });
    return;
  }

  if (payload.comment?.user?.type === "Bot") {
    res.status(200).json({ ok: true, ignored: "self_comment" });
    return;
  }

  jobQueue.schedule(issueNumber, async () => {
    await lockStore.withIssueLock(issueNumber, async () => {
      await applyIssueCommentCommand({
        github,
        owner,
        repo,
        issueNumber,
        commentBody,
        issueState: payload.issue?.state,
        originalBody: payload.issue.body || "",
        req,
        projectRoot,
        inactivityMs: config.inactivityMs,
        frameStore,
        sessionRepository,
        sessionEventRepository,
        sessionCommandRepository,
        sessionLeaseRepository,
        sessionFrameRepository,
        sessionManager
      });
    });
  });

  res.status(202).json({ ok: true, accepted: "issue_comment.created", issueNumber });
}
