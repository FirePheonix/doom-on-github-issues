const START = "<!-- ISSUE_GAME_STATE:START -->";
const END = "<!-- ISSUE_GAME_STATE:END -->";

export function formatIssueSection({ stateSummary, imageUrl, logs }) {
  const imageLine = imageUrl ? `![doom-frame](${imageUrl})` : "_Loading first frame..._";
  return [
    START,
    "## Doom-Issues Session",
    "",
    "Each new comment advances one action tick.",
    "",
    imageLine,
    "",
    `- tick: ${stateSummary.tick}`,
    `- hp: ${stateSummary.hp}`,
    `- kills: ${stateSummary.kills}/${stateSummary.targetKills}`,
    `- status: ${stateSummary.status}`,
    `- renderer: ${stateSummary.renderer}`,
    `- controls: ${stateSummary.commands}`,
    "",
    "Recent log:",
    ...logs.map((line) => `- ${line}`),
    END
  ].join("\n");
}

export function mergeIssueBody(originalBody, section) {
  const body = originalBody || "";
  const start = body.indexOf(START);
  const end = body.indexOf(END);

  if (start !== -1 && end !== -1 && end > start) {
    const before = body.slice(0, start).trimEnd();
    return `${before}\n\n${section}\n`;
  }

  if (body.trim().length === 0) {
    return `${section}\n`;
  }

  return `${body.trimEnd()}\n\n${section}\n`;
}
