import { Octokit } from "@octokit/rest";

export function createGithubClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return new Octokit({
    auth: token,
    request: {
      headers: {
        "x-github-api-version": "2022-11-28"
      }
    }
  });
}
