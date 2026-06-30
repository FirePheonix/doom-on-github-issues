import { assertIdentifier, createPgPoolProvider } from "./pg.js";

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
  const provider = createPgPoolProvider(connectionString);

  async function append(issueNumber, event) {
    const pool = await provider.getPool();
    const query = `
      insert into ${safeSchema}.${safeTable} (issue_number, event_type, event_json, created_at)
      values ($1, $2, $3::jsonb, now())
    `;
    await pool.query(query, [issueNumber, event.type, JSON.stringify(event)]);
  }

  async function list(issueNumber) {
    const pool = await provider.getPool();
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
    const pool = await provider.getPool();
    const query = `select count(*)::int as count from ${safeSchema}.${safeTable} where issue_number = $1`;
    const result = await pool.query(query, [issueNumber]);
    return result.rows[0]?.count || 0;
  }

  return {
    kind: "postgres",
    append,
    list,
    count,
    healthCheck: provider.healthCheck
  };
}
