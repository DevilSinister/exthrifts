// Persistent local MySQL for development: no install, no Docker.
//
// The official MySQL 8.4 server binary is downloaded once by
// mysql-memory-server (cached in the OS temp folder) and run directly
// against a data folder inside this project (.localdb/, gitignored), so
// your tables, pieces and orders survive restarts.
//
//   npm run db:local            start (first run creates the empty database)
//   npm run db:local -- --reset wipe .localdb/data and start empty
//
// First time only, in a second terminal:
//   npm run db:deploy && npm run db:seed && npm run db:demo
//
// Matches DATABASE_URL in .env.example. Never used in production.
// Env overrides: LOCAL_DB_PORT (default 3307), LOCAL_DB_DIR (data folder).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.LOCAL_DB_PORT || 3307);
const ROOT = path.resolve(process.cwd(), ".localdb");
const DATA = path.resolve(process.env.LOCAL_DB_DIR || path.join(ROOT, "data"));
const INIT_FILE = path.join(ROOT, "init.sql");
const EXE = process.platform === "win32" ? ".exe" : "";
const CACHE = path.join(os.tmpdir(), "mysqlmsn", "binaries");

function versionKey(v) {
  return v.split(".").map((n) => n.padStart(4, "0")).join(".");
}

function findServer() {
  if (!existsSync(CACHE)) return null;
  const versions = readdirSync(CACHE)
    .filter((v) => v.startsWith("8.4."))
    .sort((a, b) => versionKey(b).localeCompare(versionKey(a)));
  for (const v of versions) {
    const basedir = path.join(CACHE, v, "mysql");
    const mysqld = path.join(basedir, "bin", `mysqld${EXE}`);
    if (existsSync(mysqld)) return { version: v, basedir, mysqld, mysqladmin: path.join(basedir, "bin", `mysqladmin${EXE}`) };
  }
  return null;
}

async function ensureServer() {
  let server = findServer();
  if (server) return server;
  console.log("Downloading the MySQL 8.4 server binary once (about 250 MB)…");
  const { createDB } = await import("mysql-memory-server");
  const tmp = await createDB({ version: "8.4.x", downloadBinaryOnce: true, logLevel: "WARN" });
  await tmp.stop();
  server = findServer();
  if (!server) throw new Error(`MySQL binary not found in ${CACHE} after download.`);
  return server;
}

const server = await ensureServer();

if (process.argv.includes("--reset") && existsSync(DATA)) {
  console.log(`Removing ${DATA} (--reset).`);
  rmSync(DATA, { recursive: true, force: true });
}

mkdirSync(ROOT, { recursive: true });
// Idempotent: runs on every start, so the app user and database always exist.
// Prisma's `migrate dev` creates a shadow database, hence the global grant.
writeFileSync(
  INIT_FILE,
  [
    "CREATE DATABASE IF NOT EXISTS exthrifts CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    "CREATE USER IF NOT EXISTS 'exthrifts'@'%' IDENTIFIED BY 'exthrifts_local';",
    "GRANT ALL PRIVILEGES ON *.* TO 'exthrifts'@'%';",
    "FLUSH PRIVILEGES;",
    "",
  ].join("\n"),
);

const base = [`--no-defaults`, `--basedir=${server.basedir}`, `--datadir=${DATA}`];

if (!existsSync(path.join(DATA, "mysql"))) {
  console.log(`Creating a new database folder at ${DATA}…`);
  mkdirSync(path.dirname(DATA), { recursive: true });
  const init = spawnSync(server.mysqld, [...base, "--initialize-insecure"], { encoding: "utf8" });
  if (init.status !== 0) {
    console.error(init.stderr || init.stdout);
    throw new Error("mysqld --initialize-insecure failed.");
  }
}

const args = [
  ...base,
  `--port=${PORT}`,
  "--bind-address=127.0.0.1",
  "--mysqlx=OFF",
  "--console",
  "--character-set-server=utf8mb4",
  "--collation-server=utf8mb4_unicode_ci",
  `--init-file=${INIT_FILE}`,
  "--log-error-verbosity=2",
  ...(process.platform === "win32" ? [] : [`--socket=${path.join(ROOT, "mysql.sock")}`]),
];

const child = spawn(server.mysqld, args, { stdio: ["ignore", "pipe", "pipe"] });
let ready = false;
const onOutput = (chunk) => {
  const text = chunk.toString();
  if (!ready && /ready for connections/i.test(text) && text.includes(String(PORT))) {
    ready = true;
    console.log(`Local MySQL ${server.version} ready on 127.0.0.1:${PORT} (database "exthrifts").`);
    console.log(`Data is kept in ${DATA}. Press Ctrl+C to stop.`);
  }
  if (/\[ERROR\]/.test(text)) process.stderr.write(text);
};
child.stdout.on("data", onOutput);
child.stderr.on("data", onOutput);

child.on("exit", (code) => {
  if (!ready) console.error(`mysqld exited before it was ready (code ${code}). Is port ${PORT} already in use?`);
  process.exit(code ?? 0);
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  // A clean shutdown flushes InnoDB; fall back to killing the process.
  const res = spawnSync(server.mysqladmin, ["-h127.0.0.1", `-P${PORT}`, "-uroot", "shutdown"], { encoding: "utf8" });
  if (res.status !== 0) child.kill();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
