export function createIssueThrottle(cooldownMs) {
  const issueLastProcessedAt = new Map();

  function shouldThrottle(issueNumber) {
    const now = Date.now();
    const last = issueLastProcessedAt.get(issueNumber) || 0;
    if (now - last < cooldownMs) return true;
    issueLastProcessedAt.set(issueNumber, now);
    return false;
  }

  return { shouldThrottle };
}

