import { summarizeState } from "../game.js";
import { formatIssueSection, mergeIssueBody } from "../issueBody.js";
import { updateIssueBody } from "../github/issues.js";
import { frameUrlForRequest } from "../renderer/frames.js";

export async function updateIssueGameView(octokit, owner, repo, issueNumber, body, req, state) {
  const section = formatIssueSection({
    stateSummary: summarizeState(state),
    imageUrl: frameUrlForRequest(req, issueNumber, state.tick),
    logs: state.log
  });

  await updateIssueBody(octokit, owner, repo, issueNumber, mergeIssueBody(body, section));
}

