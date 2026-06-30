import { frameUrlForBaseUrl, frameUrlForRequest } from "../renderer/frames.js";

export function createLocalFrameStore() {
  return {
    kind: "local",
    async publish() {},
    publicUrl({ issueNumber, tick, req, baseUrl }) {
      if (req) {
        return frameUrlForRequest(req, issueNumber, tick);
      }
      return frameUrlForBaseUrl(baseUrl, issueNumber, tick);
    }
  };
}
