import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Octokit } from "@octokit/rest";
import { createSession, stepSession, summarizeState } from "./game.js";
import { formatIssueSection, mergeIssueBody } from "./issueBody.js";
import { ensureDataDir, getFramePath, getSessionPath, hasSession, loadSession, saveSession } from "./storage.js";
import { ensureEngineAssets, renderEngineFrame } from "./engine.js";

function verifySignature(secret, rawBody, received) {
  if (!secret) return true;
  if (!received || !received.startsWith("sha256=")) return false;

  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`);
  const actual = Buffer.from(received);

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function createLockStore() {
  const locks = new Map();

  async function withIssueLock(issueNumber, task) {
    const previous = locks.get(issueNumber) || Promise.resolve();
    const current = previous.then(task, task);
    locks.set(issueNumber, current.finally(() => {
      if (locks.get(issueNumber) === current) {
        locks.delete(issueNumber);
      }
    }));
    return current;
  }

  return { withIssueLock };
}

function createGithubClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return new Octokit({ auth: token });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function getIssueNumber(payload) {
  return payload?.issue?.number;
}

function isExpectedRepo(payload, owner, repo) {
  const gotOwner = payload?.repository?.owner?.login;
  const gotRepo = payload?.repository?.name;
  return gotOwner === owner && gotRepo === repo;
}

function inferBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  const host = req.get("x-forwarded-host") || req.get("host");
  const proto = req.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

async function updateIssueView(octokit, owner, repo, issueNumber, body, req, state) {
  const baseUrl = inferBaseUrl(req);
  const frameUrl = `${baseUrl}/frames/${issueNumber}.png?t=${state.tick}`;
  const section = formatIssueSection({
    stateSummary: summarizeState(state),
    imageUrl: frameUrl,
    logs: state.log
  });
  const merged = mergeIssueBody(body, section);

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body: merged
  });
}

async function updateIssueLoadingView(octokit, owner, repo, issueNumber, body) {
  const section = formatIssueSection({
    stateSummary: {
      tick: 0,
      hp: "loading",
      kills: "loading",
      targetKills: "loading",
      status: "loading",
      renderer: "doomgeneric",
      commands: "menu: w/s/a/d arrows, enter select, esc back | game: w/a/s/d + fire"
    },
    imageUrl: "",
    logs: ["Booting Doom engine and preparing first frame..."]
  });
  const merged = mergeIssueBody(body, section);

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body: merged
  });
}

async function persistSessionArtifacts(projectRoot, issueNumber, state) {
  await saveSession(issueNumber, state);
  await renderEngineFrame(projectRoot, getSessionPath(issueNumber), getFramePath(issueNumber));
}

export function createServer() {
  const projectRoot = process.cwd();
  const app = express();
  const github = createGithubClient();
  const lockStore = createLockStore();
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "";
  const issueCooldownMs = 1200;
  const bootDelayMs = Number(process.env.DOOM_BOOT_DELAY_MS || "2500");
  const issueLastProcessedAt = new Map();
  const issueJobStatus = new Map();

  function shouldThrottle(issueNumber) {
    const now = Date.now();
    const last = issueLastProcessedAt.get(issueNumber) || 0;
    if (now - last < issueCooldownMs) return true;
    issueLastProcessedAt.set(issueNumber, now);
    return false;
  }

  app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, githubConfigured: Boolean(github) });
  });

  app.get("/debug/issues/:issueNumber", (req, res) => {
    const issueNumber = Number(req.params.issueNumber);
    if (!Number.isFinite(issueNumber)) {
      res.status(400).json({ ok: false, error: "invalid_issue_number" });
      return;
    }

    const status = issueJobStatus.get(issueNumber) || { state: "unknown" };
    res.json({ ok: true, issueNumber, status });
  });

  app.get("/frames/:issueNumber.png", async (req, res) => {
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

  app.post("/webhook", async (req, res) => {
    try {
      const signature = req.get("x-hub-signature-256");
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
      if (!verifySignature(webhookSecret, rawBody, signature)) {
        res.status(401).json({ ok: false, error: "invalid_signature" });
        return;
      }

      if (!github) {
        res.status(500).json({ ok: false, error: "missing_github_token" });
        return;
      }

      const owner = requiredEnv("GITHUB_OWNER");
      const repo = requiredEnv("GITHUB_REPO");
      const event = req.get("x-github-event");
      const payload = req.body;

      if (!isExpectedRepo(payload, owner, repo)) {
        res.status(403).json({ ok: false, error: "unexpected_repository" });
        return;
      }
      const schedule = (issueNumber, job, delayMs = 0) => {
        issueJobStatus.set(issueNumber, {
          state: "queued",
          at: new Date().toISOString()
        });
        setTimeout(async () => {
          try {
            issueJobStatus.set(issueNumber, {
              state: "running",
              at: new Date().toISOString()
            });
            await ensureEngineAssets(projectRoot);
            await job();
            issueJobStatus.set(issueNumber, {
              state: "completed",
              at: new Date().toISOString()
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            issueJobStatus.set(issueNumber, {
              state: "failed",
              at: new Date().toISOString(),
              error: message
            });
            console.error("Webhook job failed:", error);
          }
        }, Math.max(0, delayMs));
      };

      if (event === "issues" && payload?.action === "opened") {
        const issueNumber = getIssueNumber(payload);
        if (!issueNumber) {
          res.status(200).json({ ok: true, ignored: "missing_issue_number" });
          return;
        }

        await updateIssueLoadingView(github, owner, repo, issueNumber, payload.issue.body || "");

        schedule(issueNumber, async () => {
          await lockStore.withIssueLock(issueNumber, async () => {
            await ensureDataDir();
            const state = createSession(issueNumber);
            await persistSessionArtifacts(projectRoot, issueNumber, state);
            await updateIssueView(github, owner, repo, issueNumber, payload.issue.body || "", req, state);
          });
        }, bootDelayMs);
        res.status(202).json({ ok: true, accepted: "issues.opened", issueNumber });
        return;
      }

      if (event === "issue_comment" && payload?.action === "created") {
        const issueNumber = getIssueNumber(payload);
        if (!issueNumber) {
          res.status(200).json({ ok: true, ignored: "missing_issue_number" });
          return;
        }
        if (shouldThrottle(issueNumber)) {
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

        schedule(issueNumber, async () => {
          await lockStore.withIssueLock(issueNumber, async () => {
            await ensureDataDir();

            let state;
            if (await hasSession(issueNumber)) {
              state = await loadSession(issueNumber);
            } else {
              state = createSession(issueNumber);
            }

            stepSession(state, commentBody);
            await persistSessionArtifacts(projectRoot, issueNumber, state);
            await updateIssueView(github, owner, repo, issueNumber, payload.issue.body || "", req, state);
          });
        });
        res.status(202).json({ ok: true, accepted: "issue_comment.created", issueNumber });
        return;
      }

      res.json({ ok: true, ignored: `${event || "unknown"}` });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  return app;
}
