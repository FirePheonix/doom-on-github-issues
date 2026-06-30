function createMissingPgError() {
  return new Error("Postgres session repository requires the `pg` package. Install it before enabling SESSION_REPOSITORY=postgres.");
}

function assertIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid Postgres identifier for ${label}: ${value}`);
  }
  return value;
}

export function createPostgresSessionRepository({
  connectionString = process.env.DATABASE_URL,
  schema = process.env.SESSION_REPOSITORY_SCHEMA || "public",
  table = process.env.SESSION_REPOSITORY_TABLE || "issue_sessions"
} = {}) {
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL for Postgres session repository");
  }

  const safeSchema = assertIdentifier(schema, "schema");
  const safeTable = assertIdentifier(table, "table");

  let poolPromise = null;

  async function getPool() {
    if (!poolPromise) {
      poolPromise = import("pg")
        .then(({ Pool }) => new Pool({ connectionString }))
        .catch(() => {
          throw createMissingPgError();
        });
    }
    return poolPromise;
  }

  async function load(issueNumber) {
    const pool = await getPool();
    const query = `select session_json from ${safeSchema}.${safeTable} where issue_number = $1`;
    const result = await pool.query(query, [issueNumber]);
    if (result.rowCount === 0) {
      throw new Error(`Session not found for issue ${issueNumber}`);
    }
    return result.rows[0].session_json;
  }

  async function loadOptional(issueNumber) {
    const pool = await getPool();
    const query = `select session_json from ${safeSchema}.${safeTable} where issue_number = $1`;
    const result = await pool.query(query, [issueNumber]);
    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0].session_json;
  }

  async function save(issueNumber, state) {
    const pool = await getPool();
    const query = `
      insert into ${safeSchema}.${safeTable} (issue_number, session_json, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (issue_number)
      do update set session_json = excluded.session_json, updated_at = now()
    `;
    await pool.query(query, [issueNumber, JSON.stringify(state)]);
  }

  async function exists(issueNumber) {
    const pool = await getPool();
    const query = `select 1 from ${safeSchema}.${safeTable} where issue_number = $1`;
    const result = await pool.query(query, [issueNumber]);
    return result.rowCount > 0;
  }

  async function listByStatus(statuses = []) {
    const pool = await getPool();
    if (!Array.isArray(statuses) || statuses.length === 0) {
      const query = `select session_json from ${safeSchema}.${safeTable} order by updated_at desc`;
      const result = await pool.query(query);
      return result.rows.map((row) => row.session_json);
    }

    const query = `
      select session_json
      from ${safeSchema}.${safeTable}
      where session_json->>'status' = any($1::text[])
      order by updated_at desc
    `;
    const result = await pool.query(query, [statuses]);
    return result.rows.map((row) => row.session_json);
  }

  return {
    kind: "postgres",
    load,
    loadOptional,
    save,
    exists,
    listByStatus
  };
}
