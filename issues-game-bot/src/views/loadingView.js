import { formatIssueSection, mergeIssueBody } from "../issueBody.js";
import { updateIssueBody } from "../github/issues.js";

export async function updateIssueLoadingView(octokit, owner, repo, issueNumber, body, imageUrl = "") {
  const section = formatIssueSection({
    stateSummary: {
      tick: 0,
      hp: "loading",
      kills: "loading",
      targetKills: "loading",
      status: "loading",
      renderer: "doomgeneric",
      commands: "menu/game: w/s/a/d arrows, enter/space use, esc back, fire attack | exit | restart"
    },
    imageUrl,
    logs: imageUrl
      ? ["Showing cached boot frame while the live session starts..."]
      : ["Booting Doom engine and preparing first frame..."]
  });

  await updateIssueBody(octokit, owner, repo, issueNumber, mergeIssueBody(body, section));
}
