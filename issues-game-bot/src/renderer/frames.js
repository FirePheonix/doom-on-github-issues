import { inferBaseUrl } from "../github/issues.js";

export function frameUrlForBaseUrl(baseUrl, issueNumber, tick) {
  return `${baseUrl.replace(/\/$/, "")}/frames/${issueNumber}.png?t=${tick}`;
}

export function frameUrlForRequest(req, issueNumber, tick) {
  return frameUrlForBaseUrl(inferBaseUrl(req), issueNumber, tick);
}
