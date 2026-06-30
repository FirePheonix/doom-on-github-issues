import { summarizeState } from "../game.js";
import { formatIssueSection, mergeIssueBody } from "../issueBody.js";
import { inferBaseUrlFromEnv, updateIssueBody } from "../github/issues.js";

export async function updateIssueGameView(octokit, owner, repo, issueNumber, body, req, state, frameStore, baseUrl = "") {
  const imageUrl = frameStore.publicUrl({
    issueNumber,
    tick: state.tick,
    req,
    baseUrl: baseUrl || inferBaseUrlFromEnv()
  });

  const section = formatIssueSection({
    stateSummary: summarizeState(state),
    imageUrl,
    logs: state.log
  });

  await updateIssueBody(octokit, owner, repo, issueNumber, mergeIssueBody(body, section));
}
