import { createSession, normalizeCommand, stepSession } from "../game.js";
import { getIssueBody, inferBaseUrlFromEnv, postIssueComment } from "../github/issues.js";
import { ensureDataDir } from "../storage.js";
import { updateIssueGameView } from "../views/gameView.js";
import { isSessionInactive } from "./inactivity.js";
import { persistSessionArtifacts } from "./artifacts.js";

async function saveSessionState(sessionRepository, sessionManager, issueNumber, state) {
  await sessionRepository.save(issueNumber, state);
  sessionManager?.rememberState?.(issueNumber, state);
}

async function appendSessionEvent(sessionEventRepository, issueNumber, event) {
  if (!sessionEventRepository) return;
  await sessionEventRepository.append(issueNumber, {
    ...event,
    issueNumber,
    at: new Date().toISOString()
  });
}

export async function startIssueSession({ github, owner, repo, issueNumber, originalBody, req, projectRoot, sessionRepository, sessionEventRepository, sessionManager }) {
  await ensureDataDir();
  const state = createSession(issueNumber);
  await persistSessionArtifacts({
    projectRoot,
    issueNumber,
    state,
    sessionRepository,
    mode: "start",
    sessionManager
  });
  await appendSessionEvent(sessionEventRepository, issueNumber, {
    type: "session.started",
    tick: state.tick,
    status: state.status
  });
  await updateIssueGameView(github, owner, repo, issueNumber, originalBody, req, state);
}

export async function closeIssueSession({ github, owner, repo, issueNumber, sessionRepository, sessionEventRepository, sessionManager }) {
  await ensureDataDir();
  const state = sessionManager?.getState?.(issueNumber) || await sessionRepository.loadOptional(issueNumber);
  if (!state) return;
  state.issueState = "closed";
  state.status = "closed";
  state.log = ["Issue closed. Session frozen. Reopen issue or comment `restart` to start fresh."];
  await saveSessionState(sessionRepository, sessionManager, issueNumber, state);
  await sessionManager?.stopSession?.(issueNumber, "closed");
  await appendSessionEvent(sessionEventRepository, issueNumber, {
    type: "issue.closed",
    tick: state.tick,
    status: state.status
  });

  await postIssueComment(
    github,
    owner,
    repo,
    issueNumber,
    "Issue closed: session frozen. Reopen this issue to resume, or comment `restart` to start a new run."
  );
}

export async function reopenIssueSession({ github, owner, repo, issueNumber, sessionRepository, sessionEventRepository, sessionManager }) {
  await ensureDataDir();
  const state = sessionManager?.getState?.(issueNumber) || await sessionRepository.loadOptional(issueNumber);
  if (!state) return;
  state.issueState = "open";
  if (state.status === "closed") {
    state.status = "active";
    state.log.unshift("Issue reopened. Session resumed.");
  }
  await saveSessionState(sessionRepository, sessionManager, issueNumber, state);
  await appendSessionEvent(sessionEventRepository, issueNumber, {
    type: "issue.reopened",
    tick: state.tick,
    status: state.status
  });
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
  inactivityMs,
  sessionRepository,
  sessionEventRepository,
  sessionManager
}) {
  await ensureDataDir();

  const state =
    sessionManager?.getState?.(issueNumber) ||
    await sessionRepository.loadOptional(issueNumber) ||
    createSession(issueNumber);

  const command = normalizeCommand(commentBody);
  state.issueState = issueState || state.issueState || "open";

  if (command !== "restart" && isSessionInactive(state, inactivityMs) && state.status === "active") {
    state.status = "exited";
    state.inactivityNotifiedAt = new Date().toISOString();
    state.log = [`Game exited after ${Math.floor(inactivityMs / 60000)} minutes of inactivity.`];
    await saveSessionState(sessionRepository, sessionManager, issueNumber, state);
    await sessionManager?.stopSession?.(issueNumber, "inactive");
    await appendSessionEvent(sessionEventRepository, issueNumber, {
      type: "session.exited.inactive.lazy",
      tick: state.tick,
      status: state.status
    });
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      sessionRepository,
      sessionEventRepository,
      sessionManager,
      state,
      body: `Game exited after inactivity (>${Math.floor(inactivityMs / 60000)} minutes). The GitHub issue stays open. Comment \`restart\` to start a new run.`
    });
    return;
  }

  if ((state.status === "inactive" || state.status === "exited" || state.status === "closed") && command !== "restart") {
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      sessionRepository,
      sessionEventRepository,
      sessionManager,
      state,
      body: "Game is not running. Comment `restart` to start a new run."
    });
    return;
  }

  if (state.issueState === "closed" && command !== "restart") {
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      sessionRepository,
      sessionEventRepository,
      sessionManager,
      state,
      body: "Issue is closed. Reopen issue or comment `restart` to continue."
    });
    return;
  }

  const transition = stepSession(state, commentBody);
  if (transition.acceptedCommand) {
    await appendSessionEvent(sessionEventRepository, issueNumber, {
      type: "command.applied",
      rawCommand: commentBody,
      acceptedCommand: transition.acceptedCommand,
      repeated: transition.appliedCommands.length,
      restarted: transition.restarted,
      tickBefore: state.tick - transition.appliedCommands.length,
      tickAfter: state.tick
    });
  } else if (commentBody?.trim()) {
    await appendSessionEvent(sessionEventRepository, issueNumber, {
      type: "command.ignored",
      rawCommand: commentBody,
      reason: "unknown_or_noop",
      tick: state.tick
    });
  }
  if (state.status === "exited") {
    await sessionManager?.stopSession?.(issueNumber, "exited");
    await appendSessionEvent(sessionEventRepository, issueNumber, {
      type: "session.exited.command",
      rawCommand: commentBody,
      tick: state.tick,
      status: state.status
    });
  }
  const mode = transition.restarted ? "restart" : "step";
  await persistSessionArtifacts({
    projectRoot,
    issueNumber,
    state,
    sessionRepository,
    sessionManager,
    mode,
    appliedCommands: transition.appliedCommands
  });
  await updateIssueGameView(github, owner, repo, issueNumber, originalBody, req, state);
}

export async function expireIssueSession({ github, owner, repo, issueNumber, sessionRepository, sessionEventRepository, sessionManager, inactivityMs }) {
  await ensureDataDir();
  const state = sessionManager?.getState?.(issueNumber) || await sessionRepository.loadOptional(issueNumber);
  if (!state) return;
  if (state.status !== "active") {
    await sessionManager?.setStatus?.(issueNumber, state.status);
    return;
  }

  state.status = "exited";
  state.inactivityNotifiedAt = new Date().toISOString();
  const minutes = Math.max(1, Math.floor(inactivityMs / 60000));
  state.log = [`Game exited after ${minutes} minutes of inactivity.`];
  await saveSessionState(sessionRepository, sessionManager, issueNumber, state);
  await sessionManager?.stopSession?.(issueNumber, "inactive");
  await appendSessionEvent(sessionEventRepository, issueNumber, {
    type: "session.exited.inactive.timer",
    tick: state.tick,
    status: state.status
  });
  try {
    const issueBody = await getIssueBody(github, owner, repo, issueNumber);
    await updateIssueGameView(github, owner, repo, issueNumber, issueBody, null, state, inferBaseUrlFromEnv());
  } catch (error) {
    console.error(`Failed to refresh issue body after inactivity for issue ${issueNumber}`, error);
  }
  await postPauseNoticeOnce({
    github,
    owner,
    repo,
    issueNumber,
    sessionRepository,
    sessionEventRepository,
    sessionManager,
    state,
    body: `Game exited after inactivity (>${minutes} minutes). The GitHub issue stays open. Comment \`restart\` to start a new run.`
  });
}

async function postPauseNoticeOnce({ github, owner, repo, issueNumber, sessionRepository, sessionEventRepository, sessionManager, state, body }) {
  if (state.pauseNoticeNotifiedAt) {
    return;
  }

  state.pauseNoticeNotifiedAt = new Date().toISOString();
  await sessionRepository.save(issueNumber, state);
  sessionManager?.rememberState?.(issueNumber, state);
  await appendSessionEvent(sessionEventRepository, issueNumber, {
    type: "notice.pause_posted",
    tick: state.tick,
    status: state.status
  });
  await postIssueComment(github, owner, repo, issueNumber, body);
}
