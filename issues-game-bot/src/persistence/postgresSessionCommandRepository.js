import { assertIdentifier, createPgPoolProvider } from "./pg.js";

export function createPostgresSessionCommandRepository({
  connectionString = process.env.DATABASE_URL,
  schema = process.env.SESSION_COMMAND_REPOSITORY_SCHEMA || "public",
  table = process.env.SESSION_COMMAND_REPOSITORY_TABLE || "issue_session_commands"
} = {}) {
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL for Postgres session command repository");
  }

  const safeSchema = assertIdentifier(schema, "schema");
  const safeTable = assertIdentifier(table, "table");
  const provider = createPgPoolProvider(connectionString);

  async function append(issueNumber, command) {
    await appendMany(issueNumber, [command]);
  }

  async function appendMany(issueNumber, commands) {
    if (!Array.isArray(commands) || commands.length === 0) {
      return;
    }

    const pool = await provider.getPool();
    const values = [];
    const placeholders = commands.map((command, index) => {
      const offset = index * 7;
      values.push(
        issueNumber,
        command.tick ?? null,
        command.commandIndex ?? index,
        command.commandStatus ?? "accepted",
        command.rawCommand ?? null,
        command.acceptedCommand ?? null,
        JSON.stringify(command)
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}::jsonb, now())`;
    });

    const query = `
      insert into ${safeSchema}.${safeTable}
        (issue_number, tick, command_index, command_status, raw_command, accepted_command, command_json, created_at)
      values ${placeholders.join(", ")}
    `;

    await pool.query(query, values);
  }

  async function list(issueNumber) {
    const pool = await provider.getPool();
    const query = `
      select command_json
      from ${safeSchema}.${safeTable}
      where issue_number = $1
      order by id asc
    `;
    const result = await pool.query(query, [issueNumber]);
    return result.rows.map((row) => row.command_json);
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
    appendMany,
    list,
    count,
    healthCheck: provider.healthCheck
  };
}
