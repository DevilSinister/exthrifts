// Throwaway local MySQL for development and tests: no install, no Docker.
// mysql-memory-server downloads the official MySQL binary once (cached) and
// runs a fresh, empty database until this process exits. Data does not persist;
// re-run `npm run db:deploy && npm run db:seed && npm run db:demo` after start.
//
//   npm run db:local        -> MySQL on 127.0.0.1:3307, database "exthrifts"
//
// Matches DATABASE_URL in .env.example. Never used in production.
import { createDB } from "mysql-memory-server";

const PORT = Number(process.env.LOCAL_DB_PORT || 3307);

const db = await createDB({
  version: "8.4.x",
  port: PORT,
  dbName: "exthrifts",
  logLevel: "WARN",
  // Prisma's `migrate dev` needs to create a shadow database, hence the global grant.
  initSQLString: [
    "CREATE USER IF NOT EXISTS 'exthrifts'@'%' IDENTIFIED BY 'exthrifts_local';",
    "GRANT ALL PRIVILEGES ON *.* TO 'exthrifts'@'%';",
    "FLUSH PRIVILEGES;",
  ].join("\n"),
});

console.log(`Local MySQL ${db.mysql.version} ready on 127.0.0.1:${db.port} (database "${db.dbName}").`);
console.log("Press Ctrl+C to stop. Data is discarded on exit.");

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await db.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// Keep the event loop alive.
setInterval(() => {}, 1 << 30);
