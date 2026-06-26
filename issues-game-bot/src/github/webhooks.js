import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(secret, rawBody, received) {
  if (!secret) return true;
  if (!received || !received.startsWith("sha256=")) return false;

  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`);
  const actual = Buffer.from(received);

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function getIssueNumber(payload) {
  return payload?.issue?.number;
}

export function isExpectedRepo(payload, owner, repo) {
  const gotOwner = payload?.repository?.owner?.login;
  const gotRepo = payload?.repository?.name;
  return gotOwner === owner && gotRepo === repo;
}

