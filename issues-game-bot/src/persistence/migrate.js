import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createPgPoolProvider } from "./pg.js";

export async function runPostgresMigrations({
  projectRoot = process.cwd(),
  connectionString = process.env.DATABASE_URL
} = {}) {
  const provider = createPgPoolProvider(connectionString);
  const pool = await provider.getPool();
  const sqlDir = path.join(projectRoot, "sql");
  const files = (await readdir(sqlDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const sql = await readFile(path.join(sqlDir, file), "utf8");
    await pool.query(sql);
  }

  return { files };
}
