import { getDefaultEventRepositoryKind, getDefaultRepositoryKind } from "./persistence/index.js";

function main() {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalSessionRepository = process.env.SESSION_REPOSITORY;
  const originalSessionEventRepository = process.env.SESSION_EVENT_REPOSITORY;

  try {
    delete process.env.DATABASE_URL;
    delete process.env.SESSION_REPOSITORY;
    delete process.env.SESSION_EVENT_REPOSITORY;

    if (getDefaultRepositoryKind() !== "file") {
      throw new Error("Expected default repository mode to be file without DATABASE_URL");
    }

    process.env.DATABASE_URL = "postgres://example.test/db";
    if (getDefaultRepositoryKind() !== "postgres") {
      throw new Error("Expected default repository mode to switch to postgres when DATABASE_URL is present");
    }
    if (getDefaultEventRepositoryKind() !== "postgres") {
      throw new Error("Expected default event repository mode to switch to postgres when DATABASE_URL is present");
    }

    process.env.SESSION_REPOSITORY = "file";
    if (getDefaultRepositoryKind() !== "file") {
      throw new Error("Expected explicit SESSION_REPOSITORY override to win");
    }

    process.env.SESSION_EVENT_REPOSITORY = "file";
    if (getDefaultEventRepositoryKind() !== "file") {
      throw new Error("Expected explicit SESSION_EVENT_REPOSITORY override to win");
    }

    console.log("repository-mode-smoke ok");
  } finally {
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.SESSION_REPOSITORY = originalSessionRepository;
    process.env.SESSION_EVENT_REPOSITORY = originalSessionEventRepository;
  }
}

main();
