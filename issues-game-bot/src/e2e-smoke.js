import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { ensureDataDir, getBootFrameCachePath } from "./storage.js";
import { createServer } from "./server.js";

function createFakeGithubClient() {
  const issueBodies = new Map();
  const comments = [];

  return {
    issueBodies,
    comments,
    rest: {
      issues: {
        async update({ issue_number, body }) {
          issueBodies.set(issue_number, body);
          return { data: { body } };
        },
        async createComment({ issue_number, body }) {
          comments.push({ issueNumber: issue_number, body });
          return { data: { body } };
        },
        async get({ issue_number }) {
          return { data: { body: issueBodies.get(issue_number) || "" } };
        }
      }
    }
  };
}

function createFakeSessionManager() {
  const sessions = new Map();

  function ensure(issueNumber, framePath) {
    const current = sessions.get(issueNumber) || {
      state: "unknown",
      framePath,
      lastTouchedAt: null,
      expiresAt: null,
      expiring: false
    };
    current.framePath = framePath;
    current.lastTouchedAt = new Date().toISOString();
    sessions.set(issueNumber, current);
    return current;
  }

  return {
    supportsLiveRendering() {
      return true;
    },
    getLiveRenderDisableReason() {
      return "";
    },
    async startSession(issueNumber, _seed, framePath) {
      ensure(issueNumber, framePath).state = "active";
    },
    async restartSession(issueNumber, _seed, framePath) {
      ensure(issueNumber, framePath).state = "active";
    },
    async applyCommands(issueNumber, _seed, framePath) {
      ensure(issueNumber, framePath).state = "active";
    },
    async stopSession(issueNumber, status = "stopped") {
      const record = ensure(issueNumber, "");
      record.state = status;
      record.expiresAt = null;
      if (record.stateSnapshot) {
        record.stateSnapshot.status = status;
      }
    },
    async invalidate(issueNumber) {
      sessions.delete(issueNumber);
    },
    setStatus(issueNumber, status) {
      ensure(issueNumber, "").state = status;
    },
    rememberState(issueNumber, state, framePath = "") {
      const record = ensure(issueNumber, framePath);
      record.state = state.status;
      record.tick = state.tick;
      record.stateSnapshot = JSON.parse(JSON.stringify(state));
    },
    getState(issueNumber) {
      const record = sessions.get(issueNumber);
      if (!record?.stateSnapshot) {
        return null;
      }
      return JSON.parse(JSON.stringify(record.stateSnapshot));
    },
    get(issueNumber) {
      return sessions.get(issueNumber) || { state: "unknown" };
    },
    list() {
      return Array.from(sessions.entries()).map(([issueNumber, value]) => ({
        issueNumber,
        ...value
      }));
    }
  };
}

function createFakeSessionRepository() {
  const sessions = new Map();
  const stats = {
    load: 0,
    loadOptional: 0,
    save: 0
  };

  return {
    stats,
    async load(issueNumber) {
      stats.load += 1;
      const state = sessions.get(issueNumber);
      if (!state) {
        throw new Error(`Session not found for issue ${issueNumber}`);
      }
      return JSON.parse(JSON.stringify(state));
    },
    async save(issueNumber, state) {
      stats.save += 1;
      sessions.set(issueNumber, JSON.parse(JSON.stringify(state)));
    },
    async exists(issueNumber) {
      return sessions.has(issueNumber);
    },
    async loadOptional(issueNumber) {
      stats.loadOptional += 1;
      if (!sessions.has(issueNumber)) {
        return null;
      }
      return JSON.parse(JSON.stringify(sessions.get(issueNumber)));
    }
  };
}

function createFakeSessionEventRepository() {
  const events = new Map();

  return {
    async append(issueNumber, event) {
      const current = events.get(issueNumber) || [];
      current.push(JSON.parse(JSON.stringify(event)));
      events.set(issueNumber, current);
    },
    async list(issueNumber) {
      return JSON.parse(JSON.stringify(events.get(issueNumber) || []));
    },
    async count(issueNumber) {
      return (events.get(issueNumber) || []).length;
    }
  };
}

function createFakeSessionCommandRepository() {
  const commands = new Map();

  return {
    async append(issueNumber, command) {
      const current = commands.get(issueNumber) || [];
      current.push(JSON.parse(JSON.stringify(command)));
      commands.set(issueNumber, current);
    },
    async appendMany(issueNumber, items) {
      const current = commands.get(issueNumber) || [];
      current.push(...JSON.parse(JSON.stringify(items)));
      commands.set(issueNumber, current);
    },
    async list(issueNumber) {
      return JSON.parse(JSON.stringify(commands.get(issueNumber) || []));
    },
    async count(issueNumber) {
      return (commands.get(issueNumber) || []).length;
    }
  };
}

function createFakeSessionLeaseRepository() {
  const leases = new Map();

  return {
    async get(issueNumber) {
      return JSON.parse(JSON.stringify(leases.get(issueNumber) || null));
    },
    async upsert(issueNumber, lease) {
      leases.set(issueNumber, JSON.parse(JSON.stringify(lease)));
    },
    async remove(issueNumber) {
      leases.delete(issueNumber);
    },
    async list() {
      return Array.from(leases.values()).map((lease) => JSON.parse(JSON.stringify(lease)));
    }
  };
}

function createFakeSessionFrameRepository() {
  const frames = new Map();

  return {
    async append(issueNumber, frame) {
      const current = frames.get(issueNumber) || [];
      current.push(JSON.parse(JSON.stringify(frame)));
      frames.set(issueNumber, current);
    },
    async list(issueNumber) {
      return JSON.parse(JSON.stringify(frames.get(issueNumber) || []));
    },
    async count(issueNumber) {
      return (frames.get(issueNumber) || []).length;
    },
    async latest(issueNumber) {
      const current = frames.get(issueNumber) || [];
      return current.length > 0 ? JSON.parse(JSON.stringify(current[current.length - 1])) : null;
    }
  };
}

function createFakeFrameStore() {
  const published = [];

  return {
    kind: "fake",
    published,
    async publish(issueNumber, tick, localPath) {
      published.push({ issueNumber, tick, localPath });
    },
    publicUrl({ issueNumber, tick }) {
      return `https://frames.example.test/${issueNumber}.png?t=${tick}`;
    }
  };
}

function sign(secret, payload) {
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${digest}`;
}

async function waitFor(check, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for async webhook job");
}

async function postWebhook(baseUrl, secret, event, payload) {
  const body = JSON.stringify(payload);
  const response = await fetch(`${baseUrl}/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-hub-signature-256": sign(secret, body)
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${await response.text()}`);
  }
}

async function main() {
  const github = createFakeGithubClient();
  const frameStore = createFakeFrameStore();
  const sessionRepository = createFakeSessionRepository();
  const sessionManager = createFakeSessionManager();
  const config = {
    webhookSecret: "smoke-secret",
    issueCooldownMs: 0,
    bootDelayMs: 50,
    inactivityMs: 300000
  };

  process.env.GITHUB_OWNER = "FirePheonix";
  process.env.GITHUB_REPO = "doom-on-github-issues";
  process.env.PUBLIC_BASE_URL = "http://127.0.0.1";
  process.env.DOOM_BOOT_FRAME_CACHE = "true";
  process.env.DOOM_BOOT_FRAME_PREWARM = "false";
  await ensureDataDir();
  await writeFile(
    getBootFrameCachePath(),
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axl7WQAAAAASUVORK5CYII=", "base64")
  );

  const app = createServer({
    github,
    config,
    frameStore,
    sessionRepository,
    sessionManager
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  const { port } = server.address();
  process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${port}`;
  const baseUrl = process.env.PUBLIC_BASE_URL;
  const issueNumber = 4242;

  try {
    await postWebhook(baseUrl, config.webhookSecret, "issues", {
      action: "opened",
      repository: {
        owner: { login: process.env.GITHUB_OWNER },
        name: process.env.GITHUB_REPO
      },
      issue: {
        number: issueNumber,
        body: "Smoke body",
        state: "open"
      }
    });

    await waitFor(() => {
      const body = github.issueBodies.get(issueNumber) || "";
      return body.includes("- status: loading") && body.includes("![doom-frame]") && body.includes("cached boot frame");
    });

    await waitFor(() => {
      const body = github.issueBodies.get(issueNumber) || "";
      return body.includes("- status: active") && body.includes("![doom-frame]");
    });

    await postWebhook(baseUrl, config.webhookSecret, "issue_comment", {
      action: "created",
      repository: {
        owner: { login: process.env.GITHUB_OWNER },
        name: process.env.GITHUB_REPO
      },
      issue: {
        number: issueNumber,
        body: github.issueBodies.get(issueNumber) || "Smoke body",
        state: "open"
      },
      comment: {
        body: "w",
        user: { type: "User" }
      }
    });

    await waitFor(() => {
      const body = github.issueBodies.get(issueNumber) || "";
      return body.includes("- tick: 1") && body.includes("Applied command: w");
    });

    await postWebhook(baseUrl, config.webhookSecret, "issue_comment", {
      action: "created",
      repository: {
        owner: { login: process.env.GITHUB_OWNER },
        name: process.env.GITHUB_REPO
      },
      issue: {
        number: issueNumber,
        body: github.issueBodies.get(issueNumber) || "Smoke body",
        state: "open"
      },
      comment: {
        body: "d",
        user: { type: "User" }
      }
    });

    await waitFor(() => {
      const body = github.issueBodies.get(issueNumber) || "";
      return body.includes("- tick: 2") && body.includes("Applied command: d");
    });

    await postWebhook(baseUrl, config.webhookSecret, "issue_comment", {
      action: "created",
      repository: {
        owner: { login: process.env.GITHUB_OWNER },
        name: process.env.GITHUB_REPO
      },
      issue: {
        number: issueNumber,
        body: github.issueBodies.get(issueNumber) || "Smoke body",
        state: "open"
      },
      comment: {
        body: "w\nw\nr 1",
        user: { type: "User" }
      }
    });

    await waitFor(() => {
      const body = github.issueBodies.get(issueNumber) || "";
      return body.includes("- tick: 5") && body.includes("Applied command: d");
    });

    await postWebhook(baseUrl, config.webhookSecret, "issue_comment", {
      action: "created",
      repository: {
        owner: { login: process.env.GITHUB_OWNER },
        name: process.env.GITHUB_REPO
      },
      issue: {
        number: issueNumber,
        body: github.issueBodies.get(issueNumber) || "Smoke body",
        state: "open"
      },
      comment: {
        body: "dx4\nw\nw\nw\nw",
        user: { type: "User" }
      }
    });

    await waitFor(() => {
      const body = github.issueBodies.get(issueNumber) || "";
      return body.includes("- tick: 13") && body.includes("Applied command: w");
    });

    await postWebhook(baseUrl, config.webhookSecret, "issue_comment", {
      action: "created",
      repository: {
        owner: { login: process.env.GITHUB_OWNER },
        name: process.env.GITHUB_REPO
      },
      issue: {
        number: issueNumber,
        body: github.issueBodies.get(issueNumber) || "Smoke body",
        state: "open"
      },
      comment: {
        body: "space",
        user: { type: "User" }
      }
    });

    await waitFor(() => {
      const body = github.issueBodies.get(issueNumber) || "";
      return body.includes("- tick: 14") && body.includes("Applied command: space");
    });

    await postWebhook(baseUrl, config.webhookSecret, "issues", {
      action: "closed",
      repository: {
        owner: { login: process.env.GITHUB_OWNER },
        name: process.env.GITHUB_REPO
      },
      issue: {
        number: issueNumber,
        body: github.issueBodies.get(issueNumber) || "Smoke body",
        state: "closed"
      }
    });

    await waitFor(() => github.comments.some((comment) => comment.issueNumber === issueNumber));

    const debugResponse = await fetch(`${baseUrl}/debug/issues/${issueNumber}`);
    const debug = await debugResponse.json();

    if (debug.status.state !== "completed") {
      throw new Error(`Expected completed job status, got ${debug.status.state}`);
    }
    if (!["closed", "inactive", "exited", "active"].includes(debug.session.state)) {
      throw new Error(`Unexpected session state: ${debug.session.state}`);
    }
    if (sessionRepository.stats.load !== 0 || sessionRepository.stats.loadOptional !== 0) {
      throw new Error(
        `Expected hot-session cache to avoid repository reads, got load=${sessionRepository.stats.load} loadOptional=${sessionRepository.stats.loadOptional}`
      );
    }
    if (frameStore.published.length < 2) {
      throw new Error(`Expected frame store publish calls, got ${frameStore.published.length}`);
    }
    if (!String(frameStore.published[0]?.tick || "").startsWith("boot-")) {
      throw new Error(`Expected cached boot frame publish first, got tick=${frameStore.published[0]?.tick}`);
    }
    const runtimeResponse = await fetch(`${baseUrl}/debug/runtime`);
    const runtimePayload = await runtimeResponse.json();
    if (runtimePayload.repositoryInfo.frameStoreKind !== "fake") {
      throw new Error(`Expected fake frame store kind, got ${runtimePayload.repositoryInfo.frameStoreKind}`);
    }
    if (runtimePayload.repositoryInfo.sessionEventRepositoryKind !== "disabled") {
      throw new Error(`Expected disabled event repo, got ${runtimePayload.repositoryInfo.sessionEventRepositoryKind}`);
    }
    if (runtimePayload.repositoryInfo.sessionCommandRepositoryKind !== "disabled") {
      throw new Error(`Expected disabled command repo, got ${runtimePayload.repositoryInfo.sessionCommandRepositoryKind}`);
    }
    if (runtimePayload.repositoryInfo.sessionFrameRepositoryKind !== "disabled") {
      throw new Error(`Expected disabled frame repo, got ${runtimePayload.repositoryInfo.sessionFrameRepositoryKind}`);
    }
    if (runtimePayload.repositoryInfo.sessionLeaseRepositoryKind !== "disabled") {
      throw new Error(`Expected disabled lease repo, got ${runtimePayload.repositoryInfo.sessionLeaseRepositoryKind}`);
    }

    console.log("e2e-smoke ok");
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
