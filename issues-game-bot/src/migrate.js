import { runPostgresMigrations } from "./persistence/migrate.js";

runPostgresMigrations()
  .then(({ files }) => {
    console.log(`migrate ok (${files.length} files)`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
