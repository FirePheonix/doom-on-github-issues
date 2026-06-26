import { createSession, normalizeCommand, stepSession } from "../game.js";
import { postIssueComment } from "../github/issues.js";
import { ensureDataDir, hasSession, loadSession, saveSession } from "../storage.js";
import { updateIssueGameView } from "../views/gameView.js";
import { isSessionInactive } from "./inactivity.js";
import { persistSessionArtifacts } from "./artifacts.js";

export async function startIssueSession({ github, owner, repo, issueNumber, originalBody, req, projectRoot }) {
  await ensureDataDir();
  const state = createSession(issueNumber);
  await persistSessionArtifacts(projectRoot, issueNumber, state);
  await updateIssueGameView(github, owner, repo, issueNumber, originalBody, req, state);
}

export async function closeIssueSession({ github, owner, repo, issueNumber }) {
  await ensureDataDir();
  if (!(await hasSession(issueNumber))) return;

  const state = await loadSession(issueNumber);
  state.issueState = "closed";
  state.status = "closed";
  state.log = ["Issue closed. Session frozen. Reopen issue or comment `restart` to start fresh."];
  await saveSession(issueNumber, state);

  await postIssueComment(
    github,
    owner,
    repo,
    issueNumber,
    "Issue closed: session frozen. Reopen this issue to resume, or comment `restart` to start a new run."
  );
}

export async function reopenIssueSession({ github, owner, repo, issueNumber }) {
  await ensureDataDir();
  if (!(await hasSession(issueNumber))) return;

  const state = await loadSession(issueNumber);
  state.issueState = "open";
  if (state.status === "closed") {
    state.status = "active";
    state.log.unshift("Issue reopened. Session resumed.");
  }
  await saveSession(issueNumber, state);
  await postIssueComment(github, owner, repo, issueNumber, "Issue reopened: session resumed.");
}

export async function applyIssueCommentCommand({
  github,
  owner,
  repo,
  issueNumber,
  commentBody,
  issueState,
  originalBody,
  req,
  projectRoot,
  inactivityMs
}) {
  await ensureDataDir();

  let state;
  if (await hasSession(issueNumber)) {
    state = await loadSession(issueNumber);
  } else {
    state = createSession(issueNumber);
  }

  const command = normalizeCommand(commentBody);
  state.issueState = issueState || state.issueState || "open";

  if (command !== "restart" && isSessionInactive(state, inactivityMs) && state.status === "active") {
    state.status = "inactive";
    state.inactivityNotifiedAt = new Date().toISOString();
    state.log = [`Session auto-paused after ${Math.floor(inactivityMs / 60000)} minutes of inactivity.`];
    await saveSession(issueNumber, state);
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      state,
      body: `Session paused for inactivity (>${Math.floor(inactivityMs / 60000)} minutes). Comment \`restart\` to start a new run, or reopen and continue.`
    });
    return;
  }

  if ((state.status === "inactive" || state.status === "closed") && command !== "restart") {
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      state,
      body: "Session is paused. Reopen the issue or comment `restart` to start a new run."
    });
    return;
  }

  if (state.issueState === "closed" && command !== "restart") {
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      state,
      body: "Issue is closed. Reopen issue or comment `restart` to continue."
    });
    return;
  }

  stepSession(state, commentBody);
  await persistSessionArtifacts(projectRoot, issueNumber, state);
  await updateIssueGameView(github, owner, repo, issueNumber, originalBody, req, state);
}

async function postPauseNoticeOnce({ github, owner, repo, issueNumber, state, body }) {
  if (state.pauseNoticeNotifiedAt) {
    return;
  }

  state.pauseNoticeNotifiedAt = new Date().toISOString();
  await saveSession(issueNumber, state);
  await postIssueComment(github, owner, repo, issueNumber, body);
}
