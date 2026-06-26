import { formatIssueSection, mergeIssueBody } from "../issueBody.js";
import { updateIssueBody } from "../github/issues.js";

export async function updateIssueLoadingView(octokit, owner, repo, issueNumber, body) {
  const section = formatIssueSection({
    stateSummary: {
      tick: 0,
      hp: "loading",
      kills: "loading",
      targetKills: "loading",
      status: "loading",
      renderer: "doomgeneric",
      commands: "menu: w/s/a/d arrows, enter select, esc back | game: w/a/s/d + fire | exit | restart"
    },
    imageUrl: "",
    logs: ["Booting Doom engine and preparing first frame..."]
  });

  await updateIssueBody(octokit, owner, repo, issueNumber, mergeIssueBody(body, section));
}
