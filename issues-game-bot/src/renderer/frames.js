import { inferBaseUrl } from "../github/issues.js";

export function frameUrlForRequest(req, issueNumber, tick) {
  return `${inferBaseUrl(req)}/frames/${issueNumber}.png?t=${tick}`;
}

