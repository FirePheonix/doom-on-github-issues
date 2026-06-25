import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Octokit } from "@octokit/rest";
import { createSession, renderFrame, stepSession } from "./game.js";
import { formatIssueSection, mergeIssueBody } from "./issueBody.js";
import { ensureDataDir, hasSession, loadSession, saveSession } from "./storage.js";

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
  if (!token) {
    return null;
  }
  return new Octokit({ auth: token });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

async function updateIssueView(octokit, owner, repo, issueNumber, body, frame) {
  const section = formatIssueSection(frame);
  const merged = mergeIssueBody(body, section);

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body: merged
  });
}

function getIssueNumber(payload) {
  return payload?.issue?.number;
}

export function createServer() {
  const app = express();
  const github = createGithubClient();
  const lockStore = createLockStore();
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "";

  app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    }
  }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, githubConfigured: Boolean(github) });
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

      if (event === "issues" && payload?.action === "opened") {
        const issueNumber = getIssueNumber(payload);
        if (!issueNumber) {
          res.status(200).json({ ok: true, ignored: "missing_issue_number" });
          return;
        }

        await lockStore.withIssueLock(issueNumber, async () => {
          await ensureDataDir();
          const state = createSession(issueNumber);
          await saveSession(issueNumber, state);
          const frame = renderFrame(state);
          await updateIssueView(github, owner, repo, issueNumber, payload.issue.body || "", frame);
        });

        res.json({ ok: true, event: "issues.opened", issueNumber });
        return;
      }

      if (event === "issue_comment" && payload?.action === "created") {
        const issueNumber = getIssueNumber(payload);
        if (!issueNumber) {
          res.status(200).json({ ok: true, ignored: "missing_issue_number" });
          return;
        }

        await lockStore.withIssueLock(issueNumber, async () => {
          await ensureDataDir();

          let state;
          if (await hasSession(issueNumber)) {
            state = await loadSession(issueNumber);
          } else {
            state = createSession(issueNumber);
          }

          stepSession(state, payload.comment?.body || "");
          await saveSession(issueNumber, state);
          const frame = renderFrame(state);
          await updateIssueView(github, owner, repo, issueNumber, payload.issue.body || "", frame);
        });

        res.json({ ok: true, event: "issue_comment.created", issueNumber });
        return;
      }

      res.json({ ok: true, ignored: `${event || "unknown"}` });
    } catch (error) {
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  return app;
}
