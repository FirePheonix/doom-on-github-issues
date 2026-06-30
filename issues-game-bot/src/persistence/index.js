import { createFileSessionRepository } from "./fileSessionRepository.js";
import { createFileSessionEventRepository } from "./fileSessionEventRepository.js";
import { getDefaultEventRepositoryKind, getDefaultRepositoryKind } from "./pg.js";
import { createPostgresSessionRepository } from "./postgresSessionRepository.js";
import { createPostgresSessionEventRepository } from "./postgresSessionEventRepository.js";

export function createSessionRepository(options = {}) {
  const kind = (options.kind || getDefaultRepositoryKind()).trim().toLowerCase();

  if (kind === "postgres") {
    return createPostgresSessionRepository(options.postgres);
  }

  return createFileSessionRepository(options.file);
}

export function createSessionEventRepository(options = {}) {
  const kind = (options.kind || getDefaultEventRepositoryKind())
    .trim()
    .toLowerCase();

  if (kind === "postgres") {
    return createPostgresSessionEventRepository(options.postgres);
  }

  return createFileSessionEventRepository(options.file);
}

export { createFileSessionRepository } from "./fileSessionRepository.js";
export { createFileSessionEventRepository } from "./fileSessionEventRepository.js";
export { createPgPoolProvider, getDefaultEventRepositoryKind, getDefaultRepositoryKind } from "./pg.js";
export { createPostgresSessionRepository } from "./postgresSessionRepository.js";
export { createPostgresSessionEventRepository } from "./postgresSessionEventRepository.js";
