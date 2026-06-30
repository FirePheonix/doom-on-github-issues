import { assertIdentifier, createPgPoolProvider } from "./pg.js";

export function createPostgresSessionLeaseRepository({
  connectionString = process.env.DATABASE_URL,
  schema = process.env.SESSION_LEASE_REPOSITORY_SCHEMA || "public",
  table = process.env.SESSION_LEASE_REPOSITORY_TABLE || "issue_session_leases"
} = {}) {
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL for Postgres session lease repository");
  }

  const safeSchema = assertIdentifier(schema, "schema");
  const safeTable = assertIdentifier(table, "table");
  const provider = createPgPoolProvider(connectionString);

  async function get(issueNumber) {
    const pool = await provider.getPool();
    const query = `
      select issue_number, worker_id, status, source, frame_path, tick, last_touched_at, lease_expires_at, updated_at
      from ${safeSchema}.${safeTable}
      where issue_number = $1
    `;
    const result = await pool.query(query, [issueNumber]);
    if (result.rowCount === 0) {
      return null;
    }
    return result.rows[0];
  }

  async function upsert(issueNumber, lease) {
    const pool = await provider.getPool();
    const query = `
      insert into ${safeSchema}.${safeTable}
        (issue_number, worker_id, status, source, frame_path, tick, last_touched_at, lease_expires_at, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, now())
      on conflict (issue_number)
      do update
      set worker_id = excluded.worker_id,
          status = excluded.status,
          source = excluded.source,
          frame_path = excluded.frame_path,
          tick = excluded.tick,
          last_touched_at = excluded.last_touched_at,
          lease_expires_at = excluded.lease_expires_at,
          updated_at = now()
    `;
    await pool.query(query, [
      issueNumber,
      lease.workerId,
      lease.status,
      lease.source,
      lease.framePath || null,
      lease.tick ?? null,
      lease.lastTouchedAt || null,
      lease.leaseExpiresAt || null
    ]);
  }

  async function remove(issueNumber) {
    const pool = await provider.getPool();
    const query = `delete from ${safeSchema}.${safeTable} where issue_number = $1`;
    await pool.query(query, [issueNumber]);
  }

  async function list() {
    const pool = await provider.getPool();
    const query = `
      select issue_number, worker_id, status, source, frame_path, tick, last_touched_at, lease_expires_at, updated_at
      from ${safeSchema}.${safeTable}
      order by updated_at desc
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  return {
    kind: "postgres",
    get,
    upsert,
    remove,
    list,
    healthCheck: provider.healthCheck
  };
}
