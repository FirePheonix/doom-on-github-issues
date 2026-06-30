import { createFileSessionRepository } from "./fileSessionRepository.js";
import { createPostgresSessionRepository } from "./postgresSessionRepository.js";

export function createSessionRepository(options = {}) {
  const kind = (options.kind || process.env.SESSION_REPOSITORY || "file").trim().toLowerCase();

  if (kind === "postgres") {
    return createPostgresSessionRepository(options.postgres);
  }

  return createFileSessionRepository(options.file);
}

export { createFileSessionRepository } from "./fileSessionRepository.js";
export { createPostgresSessionRepository } from "./postgresSessionRepository.js";
