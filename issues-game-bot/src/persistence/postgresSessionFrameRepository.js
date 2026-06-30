import { assertIdentifier, createPgPoolProvider } from "./pg.js";

export function createPostgresSessionFrameRepository({
  connectionString = process.env.DATABASE_URL,
  schema = process.env.SESSION_FRAME_REPOSITORY_SCHEMA || "public",
  table = process.env.SESSION_FRAME_REPOSITORY_TABLE || "issue_session_frames"
} = {}) {
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL for Postgres session frame repository");
  }

  const safeSchema = assertIdentifier(schema, "schema");
  const safeTable = assertIdentifier(table, "table");
  const provider = createPgPoolProvider(connectionString);

  async function append(issueNumber, frame) {
    const pool = await provider.getPool();
    const query = `
      insert into ${safeSchema}.${safeTable}
        (issue_number, tick, frame_store_kind, frame_ref, public_url, frame_json, published_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, now())
      on conflict (issue_number, tick)
      do update
      set frame_store_kind = excluded.frame_store_kind,
          frame_ref = excluded.frame_ref,
          public_url = excluded.public_url,
          frame_json = excluded.frame_json,
          published_at = now()
    `;
    await pool.query(query, [
      issueNumber,
      frame.tick,
      frame.frameStoreKind,
      frame.frameRef,
      frame.publicUrl || null,
      JSON.stringify(frame)
    ]);
  }

  async function latest(issueNumber) {
    const pool = await provider.getPool();
    const query = `
      select frame_json
      from ${safeSchema}.${safeTable}
      where issue_number = $1
      order by tick desc
      limit 1
    `;
    const result = await pool.query(query, [issueNumber]);
    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0].frame_json;
  }

  async function list(issueNumber) {
    const pool = await provider.getPool();
    const query = `
      select frame_json
      from ${safeSchema}.${safeTable}
      where issue_number = $1
      order by tick asc
    `;
    const result = await pool.query(query, [issueNumber]);
    return result.rows.map((row) => row.frame_json);
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
    latest,
    list,
    count,
    healthCheck: provider.healthCheck
  };
}
