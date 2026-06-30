import { createFileSessionRepository } from "./fileSessionRepository.js";
import { createFileSessionEventRepository } from "./fileSessionEventRepository.js";
import { createPostgresSessionRepository } from "./postgresSessionRepository.js";
import { createPostgresSessionEventRepository } from "./postgresSessionEventRepository.js";

export function createSessionRepository(options = {}) {
  const kind = (options.kind || process.env.SESSION_REPOSITORY || "file").trim().toLowerCase();

  if (kind === "postgres") {
    return createPostgresSessionRepository(options.postgres);
  }

  return createFileSessionRepository(options.file);
}

export function createSessionEventRepository(options = {}) {
  const kind = (options.kind || process.env.SESSION_EVENT_REPOSITORY || process.env.SESSION_REPOSITORY || "file")
    .trim()
    .toLowerCase();

  if (kind === "postgres") {
    return createPostgresSessionEventRepository(options.postgres);
  }

  return createFileSessionEventRepository(options.file);
}

export { createFileSessionRepository } from "./fileSessionRepository.js";
export { createFileSessionEventRepository } from "./fileSessionEventRepository.js";
export { createPostgresSessionRepository } from "./postgresSessionRepository.js";
export { createPostgresSessionEventRepository } from "./postgresSessionEventRepository.js";
