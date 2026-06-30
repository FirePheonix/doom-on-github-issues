import { summarizeState } from "../game.js";
import { formatIssueSection, mergeIssueBody } from "../issueBody.js";
import { inferBaseUrlFromEnv, updateIssueBody } from "../github/issues.js";
import { frameUrlForBaseUrl, frameUrlForRequest } from "../renderer/frames.js";

export async function updateIssueGameView(octokit, owner, repo, issueNumber, body, req, state, baseUrl = "") {
  const imageUrl = req
    ? frameUrlForRequest(req, issueNumber, state.tick)
    : frameUrlForBaseUrl(baseUrl || inferBaseUrlFromEnv(), issueNumber, state.tick);

  const section = formatIssueSection({
    stateSummary: summarizeState(state),
    imageUrl,
    logs: state.log
  });

  await updateIssueBody(octokit, owner, repo, issueNumber, mergeIssueBody(body, section));
}
