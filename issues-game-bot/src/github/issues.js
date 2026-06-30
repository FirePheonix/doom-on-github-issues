export function inferBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  const host = req.get("x-forwarded-host") || req.get("host");
  const proto = req.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export function inferBaseUrlFromEnv() {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  throw new Error("PUBLIC_BASE_URL or RAILWAY_PUBLIC_DOMAIN is required when no request is available");
}

export async function postIssueComment(octokit, owner, repo, issueNumber, body) {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });
}

export async function updateIssueBody(octokit, owner, repo, issueNumber, body) {
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body
  });
}

export async function getIssueBody(octokit, owner, repo, issueNumber) {
  const response = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber
  });
  return response.data.body || "";
}
