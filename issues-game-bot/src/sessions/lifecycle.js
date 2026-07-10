import { createSession, parseCommentCommands, stepSession } from "../game.js";
import { getIssueBody, inferBaseUrlFromEnv, postIssueComment } from "../github/issues.js";
import { ensureDataDir } from "../storage.js";
import { updateIssueGameView } from "../views/gameView.js";
import { isSessionInactive } from "./inactivity.js";
import { persistSessionArtifacts } from "./artifacts.js";

function persistSessionStateLater(sessionRepository, sessionManager, issueNumber, state) {
  sessionManager?.rememberState?.(issueNumber, state);
  void sessionRepository.save(issueNumber, state).catch((error) => {
    console.error(`Failed to persist session for issue ${issueNumber}`, error);
  });
}

export async function startIssueSession({ github, owner, repo, issueNumber, originalBody, req, projectRoot, frameStore, sessionRepository, sessionEventRepository, sessionCommandRepository, sessionFrameRepository, sessionManager }) {
  await ensureDataDir();
  const state = createSession(issueNumber);
  const artifactResult = await persistSessionArtifacts({
    projectRoot,
    issueNumber,
    state,
    frameStore,
    mode: "start",
    sessionManager
  });
  await updateIssueGameView(github, owner, repo, issueNumber, originalBody, req, state, frameStore, "", artifactResult?.imageUrlOverride || "");
  persistSessionStateLater(sessionRepository, sessionManager, issueNumber, state);
}

export async function closeIssueSession({ github, owner, repo, issueNumber, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager }) {
  await ensureDataDir();
  const state = sessionManager?.getState?.(issueNumber) || await sessionRepository.loadOptional(issueNumber);
  if (!state) return;
  state.issueState = "closed";
  state.status = "closed";
  state.log = ["Issue closed. Session frozen. Reopen issue or comment `restart` to start fresh."];
  sessionManager?.rememberState?.(issueNumber, state);
  await sessionManager?.stopSession?.(issueNumber, "closed");

  await postIssueComment(
    github,
    owner,
    repo,
    issueNumber,
    "Issue closed: session frozen. Reopen this issue to resume, or comment `restart` to start a new run."
  );
  persistSessionStateLater(sessionRepository, sessionManager, issueNumber, state);
}

export async function reopenIssueSession({ github, owner, repo, issueNumber, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager }) {
  await ensureDataDir();
  const state = sessionManager?.getState?.(issueNumber) || await sessionRepository.loadOptional(issueNumber);
  if (!state) return;
  state.issueState = "open";
  if (state.status === "closed") {
    state.status = "active";
    state.log.unshift("Issue reopened. Session resumed.");
  }
  sessionManager?.rememberState?.(issueNumber, state);
  await postIssueComment(github, owner, repo, issueNumber, "Issue reopened: session resumed.");
  persistSessionStateLater(sessionRepository, sessionManager, issueNumber, state);
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
  frameStore,
  sessionRepository,
  sessionEventRepository,
  sessionCommandRepository,
  sessionLeaseRepository,
  sessionFrameRepository,
  sessionManager
}) {
  await ensureDataDir();

  const state =
    sessionManager?.getState?.(issueNumber) ||
    await sessionRepository.loadOptional(issueNumber) ||
    createSession(issueNumber);

  const parsedCommands = parseCommentCommands(commentBody);
  const hasRestart = parsedCommands.some((entry) => entry.acceptedCommand === "restart");
  state.issueState = issueState || state.issueState || "open";

  if (!hasRestart && isSessionInactive(state, inactivityMs) && state.status === "active") {
    state.status = "exited";
    state.inactivityNotifiedAt = new Date().toISOString();
    state.log = [`Game exited after ${Math.floor(inactivityMs / 60000)} minutes of inactivity.`];
    sessionManager?.rememberState?.(issueNumber, state);
    await sessionManager?.stopSession?.(issueNumber, "inactive");
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      sessionRepository,
      sessionManager,
      state,
      body: `Game exited after inactivity (>${Math.floor(inactivityMs / 60000)} minutes). The GitHub issue stays open. Comment \`restart\` to start a new run.`
    });
    return;
  }

  if ((state.status === "inactive" || state.status === "exited" || state.status === "closed") && !hasRestart) {
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      sessionRepository,
      sessionManager,
      state,
      body: "Game is not running. Comment `restart` to start a new run."
    });
    return;
  }

  if (state.issueState === "closed" && !hasRestart) {
    await postPauseNoticeOnce({
      github,
      owner,
      repo,
      issueNumber,
      sessionRepository,
      sessionManager,
      state,
      body: "Issue is closed. Reopen issue or comment `restart` to continue."
    });
    return;
  }

  const transition = stepSession(state, commentBody);
  if (state.status === "exited") {
    await sessionManager?.stopSession?.(issueNumber, "exited");
  }
  const mode = transition.restarted ? "restart" : "step";
    const artifactResult = await persistSessionArtifacts({
      projectRoot,
      issueNumber,
      state,
      frameStore,
      sessionManager,
      mode,
      appliedCommands: transition.appliedCommands
    });
  await updateIssueGameView(github, owner, repo, issueNumber, originalBody, req, state, frameStore, "", artifactResult?.imageUrlOverride || "");
  persistSessionStateLater(sessionRepository, sessionManager, issueNumber, state);
}

export async function expireIssueSession({ github, owner, repo, issueNumber, frameStore, sessionRepository, sessionEventRepository, sessionLeaseRepository, sessionManager, inactivityMs }) {
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
  sessionManager?.rememberState?.(issueNumber, state);
  await sessionManager?.stopSession?.(issueNumber, "inactive");
  try {
    const issueBody = await getIssueBody(github, owner, repo, issueNumber);
    await updateIssueGameView(github, owner, repo, issueNumber, issueBody, null, state, frameStore, inferBaseUrlFromEnv());
  } catch (error) {
    console.error(`Failed to refresh issue body after inactivity for issue ${issueNumber}`, error);
  }
  await postPauseNoticeOnce({
    github,
    owner,
    repo,
    issueNumber,
    sessionRepository,
    sessionManager,
    state,
    body: `Game exited after inactivity (>${minutes} minutes). The GitHub issue stays open. Comment \`restart\` to start a new run.`
  });
}

async function postPauseNoticeOnce({ github, owner, repo, issueNumber, sessionRepository, sessionManager, state, body }) {
  if (state.pauseNoticeNotifiedAt) {
    return;
  }

  state.pauseNoticeNotifiedAt = new Date().toISOString();
  sessionManager?.rememberState?.(issueNumber, state);
  await postIssueComment(github, owner, repo, issueNumber, body);
  persistSessionStateLater(sessionRepository, sessionManager, issueNumber, state);
}
