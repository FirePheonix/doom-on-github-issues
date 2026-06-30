export function assertIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid Postgres identifier for ${label}: ${value}`);
  }
  return value;
}

export function getDefaultRepositoryKind(env = process.env) {
  const configured = env.SESSION_REPOSITORY?.trim().toLowerCase();
  if (configured) {
    return configured;
  }
  return env.DATABASE_URL ? "postgres" : "file";
}

export function getDefaultEventRepositoryKind(env = process.env) {
  const configured = env.SESSION_EVENT_REPOSITORY?.trim().toLowerCase();
  if (configured) {
    return configured;
  }
  return getDefaultRepositoryKind(env);
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
