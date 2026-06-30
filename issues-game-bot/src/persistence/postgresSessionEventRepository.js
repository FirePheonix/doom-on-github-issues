function createMissingPgError() {
  return new Error("Postgres session event repository requires the `pg` package. Install it before enabling SESSION_EVENT_REPOSITORY=postgres.");
}

function assertIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid Postgres identifier for ${label}: ${value}`);
  }
  return value;
}

export function createPostgresSessionEventRepository({
  connectionString = process.env.DATABASE_URL,
  schema = process.env.SESSION_EVENT_REPOSITORY_SCHEMA || "public",
  table = process.env.SESSION_EVENT_REPOSITORY_TABLE || "issue_session_events"
} = {}) {
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL for Postgres session event repository");
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

  async function append(issueNumber, event) {
    const pool = await getPool();
    const query = `
      insert into ${safeSchema}.${safeTable} (issue_number, event_type, event_json, created_at)
      values ($1, $2, $3::jsonb, now())
    `;
    await pool.query(query, [issueNumber, event.type, JSON.stringify(event)]);
  }

  async function list(issueNumber) {
    const pool = await getPool();
    const query = `
      select event_json
      from ${safeSchema}.${safeTable}
      where issue_number = $1
      order by id asc
    `;
    const result = await pool.query(query, [issueNumber]);
    return result.rows.map((row) => row.event_json);
  }

  async function count(issueNumber) {
    const pool = await getPool();
    const query = `select count(*)::int as count from ${safeSchema}.${safeTable} where issue_number = $1`;
    const result = await pool.query(query, [issueNumber]);
    return result.rows[0]?.count || 0;
  }

  return {
    kind: "postgres",
    append,
    list,
    count
  };
}
