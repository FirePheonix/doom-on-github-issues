const START = "<!-- ISSUE_GAME_STATE:START -->";
const END = "<!-- ISSUE_GAME_STATE:END -->";
const STATE_BLOCK_RE = /<!-- ISSUE_GAME_STATE:START -->[\s\S]*?<!-- ISSUE_GAME_STATE:END -->\s*/g;

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
  const hasAnyStateBlock = STATE_BLOCK_RE.test(body);
  STATE_BLOCK_RE.lastIndex = 0;
  const stripped = body.replace(STATE_BLOCK_RE, "").trimEnd();

  if (hasAnyStateBlock) {
    if (stripped.length === 0) {
      return `${section}\n`;
    }
    return `${stripped}\n\n${section}\n`;
  }

  if (body.trim().length === 0) {
    return `${section}\n`;
  }

  return `${body.trimEnd()}\n\n${section}\n`;
}
