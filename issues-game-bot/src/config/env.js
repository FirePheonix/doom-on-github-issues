export function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export function readRuntimeConfig() {
  return {
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
    issueCooldownMs: Number(process.env.ISSUE_COOLDOWN_MS || "1200"),
    bootDelayMs: Number(process.env.DOOM_BOOT_DELAY_MS || "500"),
    inactivityMs: Number(process.env.DOOM_INACTIVITY_MS || "300000")
  };
}

export function readGithubTarget() {
  return {
    owner: requiredEnv("GITHUB_OWNER"),
    repo: requiredEnv("GITHUB_REPO")
  };
}

