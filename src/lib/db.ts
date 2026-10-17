// Server only: also imported by the seed scripts, so no "server-only" marker.
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

// One client per process. In dev, hot reloads would otherwise open a new pool
// on every edit and exhaust MySQL connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL is not set.");
  const parsed = new URL(url);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    // Shared hosting limits concurrent connections; keep the pool small.
    connectionLimit: 5,
  });
  return new PrismaClient({ adapter });
}

function createClient(): PrismaClient {
  return createPrismaClient();
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
