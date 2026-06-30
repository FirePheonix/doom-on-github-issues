import { createFileSessionCommandRepository } from "./fileSessionCommandRepository.js";
import { createFileSessionRepository } from "./fileSessionRepository.js";
import { createFileSessionEventRepository } from "./fileSessionEventRepository.js";
import { createFileSessionFrameRepository } from "./fileSessionFrameRepository.js";
import { createFileSessionLeaseRepository } from "./fileSessionLeaseRepository.js";
import {
  getDefaultCommandRepositoryKind,
  getDefaultEventRepositoryKind,
  getDefaultFrameRepositoryKind,
  getDefaultLeaseRepositoryKind,
  getDefaultRepositoryKind
} from "./pg.js";
import { createPostgresSessionCommandRepository } from "./postgresSessionCommandRepository.js";
import { createPostgresSessionRepository } from "./postgresSessionRepository.js";
import { createPostgresSessionEventRepository } from "./postgresSessionEventRepository.js";
import { createPostgresSessionFrameRepository } from "./postgresSessionFrameRepository.js";
import { createPostgresSessionLeaseRepository } from "./postgresSessionLeaseRepository.js";

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

export function createSessionCommandRepository(options = {}) {
  const kind = (options.kind || getDefaultCommandRepositoryKind()).trim().toLowerCase();

  if (kind === "postgres") {
    return createPostgresSessionCommandRepository(options.postgres);
  }

  return createFileSessionCommandRepository(options.file);
}

export function createSessionLeaseRepository(options = {}) {
  const kind = (options.kind || getDefaultLeaseRepositoryKind()).trim().toLowerCase();

  if (kind === "postgres") {
    return createPostgresSessionLeaseRepository(options.postgres);
  }

  return createFileSessionLeaseRepository(options.file);
}

export function createSessionFrameRepository(options = {}) {
  const kind = (options.kind || getDefaultFrameRepositoryKind()).trim().toLowerCase();

  if (kind === "postgres") {
    return createPostgresSessionFrameRepository(options.postgres);
  }

  return createFileSessionFrameRepository(options.file);
}

export { createFileSessionCommandRepository } from "./fileSessionCommandRepository.js";
export { createFileSessionRepository } from "./fileSessionRepository.js";
export { createFileSessionEventRepository } from "./fileSessionEventRepository.js";
export { createFileSessionFrameRepository } from "./fileSessionFrameRepository.js";
export { createFileSessionLeaseRepository } from "./fileSessionLeaseRepository.js";
export {
  createPgPoolProvider,
  getDefaultCommandRepositoryKind,
  getDefaultEventRepositoryKind,
  getDefaultFrameRepositoryKind,
  getDefaultLeaseRepositoryKind,
  getDefaultRepositoryKind
} from "./pg.js";
export { createPostgresSessionCommandRepository } from "./postgresSessionCommandRepository.js";
export { createPostgresSessionRepository } from "./postgresSessionRepository.js";
export { createPostgresSessionEventRepository } from "./postgresSessionEventRepository.js";
export { createPostgresSessionFrameRepository } from "./postgresSessionFrameRepository.js";
export { createPostgresSessionLeaseRepository } from "./postgresSessionLeaseRepository.js";
