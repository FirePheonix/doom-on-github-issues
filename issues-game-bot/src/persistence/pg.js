export function assertIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid Postgres identifier for ${label}: ${value}`);
  }
  return value;
}

function getConfiguredKind(key, env = process.env) {
  const configured = env[key]?.trim().toLowerCase();
  if (configured) {
    return configured;
  }
  return env.DATABASE_URL ? "postgres" : "file";
}

export function getDefaultRepositoryKind(env = process.env) {
  return getConfiguredKind("SESSION_REPOSITORY", env);
}

export function getDefaultEventRepositoryKind(env = process.env) {
  return getConfiguredKind("SESSION_EVENT_REPOSITORY", env);
}

export function getDefaultCommandRepositoryKind(env = process.env) {
  return getConfiguredKind("SESSION_COMMAND_REPOSITORY", env);
}

export function getDefaultLeaseRepositoryKind(env = process.env) {
  return getConfiguredKind("SESSION_LEASE_REPOSITORY", env);
}

export function getDefaultFrameRepositoryKind(env = process.env) {
  return getConfiguredKind("SESSION_FRAME_REPOSITORY", env);
}

export function createPgPoolProvider(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL for Postgres runtime");
  }

  let poolPromise = null;

  async function getPool() {
    if (!poolPromise) {
      poolPromise = import("pg").then(({ Pool }) => new Pool({ connectionString }));
    }
    return poolPromise;
  }

  async function healthCheck() {
    const pool = await getPool();
    await pool.query("select 1");
  }

  async function close() {
    if (!poolPromise) return;
    const pool = await poolPromise;
    await pool.end();
  }

  return {
    getPool,
    healthCheck,
    close
  };
}
