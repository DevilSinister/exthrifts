// Admin authentication: bcrypt passwords, database-backed sessions in an
// HttpOnly cookie. The cookie is SameSite=Lax so a notification tap that opens
// /admin/orders/<id> in the Android app still carries the session.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { site } from "@/lib/site";

export const SESSION_COOKIE = "ext_admin";
const SESSION_DAYS = 30;
const RENEW_WHEN_DAYS_LEFT = 15;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const DAY_MS = 86_400_000;

export type AdminRoleName = "OWNER" | "STAFF";

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  role: AdminRoleName;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return secret;
}

/** The DB stores an HMAC of the token, so a leaked sessions table cannot be replayed. */
function sessionId(token: string): string {
  return createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 72) return "Use at most 72 characters.";
  return null;
}

// --- per-IP throttle (single Node process on Hostinger) ----------------------
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function ipThrottled(ip: string): boolean {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + LOCK_MINUTES * 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_FAILED_LOGINS * 4;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

let dummy: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummy ??= bcrypt.hash(randomBytes(16).toString("hex"), 12);
  return dummy;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const generic = "Email or password is incorrect.";
  if (ipThrottled(await clientIp())) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };

  const user = await db.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Compare against a dummy hash when the user doesn't exist, so timing doesn't reveal accounts.
  const hash = user?.passwordHash ?? (await dummyHash());
  const now = new Date();

  if (user?.lockedUntil && user.lockedUntil > now) {
    return { ok: false, error: "This account is locked for 15 minutes after too many attempts." };
  }

  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid || !user.isActive) {
    if (user) {
      const failed = user.failedLogins + 1;
      await db.adminUser.update({
        where: { id: user.id },
        data: {
          failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
        },
      });
    }
    return { ok: false, error: generic };
  }

  await db.adminUser.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: now },
  });
  await startSession(user.id);
  return { ok: true };
}

async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  const h = await headers();
  await db.session.create({
    data: { id: sessionId(token), userId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 255) ?? null },
  });
  await setSessionCookie(token, expiresAt);
}

async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: site.url.startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sessionId(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Current admin, or null. Renews the session when it is past half its life. */
export async function getAdmin(): Promise<AdminIdentity | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: sessionId(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;

  if (session.expiresAt.getTime() - Date.now() < RENEW_WHEN_DAYS_LEFT * DAY_MS) {
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } });
    // Cookies can only be written from actions and route handlers; ignore elsewhere.
    try {
      await setSessionCookie(token, expiresAt);
    } catch {
      /* rendering a server component: the DB row is renewed, the cookie on next action */
    }
  }

  const { id, email, name, role } = session.user;
  return { id, email, name, role };
}

/** For pages and layouts: redirects to the login page when signed out. */
export async function requireAdmin(role?: AdminRoleName): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (role === "OWNER" && admin.role !== "OWNER") redirect("/admin?denied=1");
  return admin;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertAdmin(role?: AdminRoleName): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) throw new AuthError("Please sign in again.", 401);
  if (role === "OWNER" && admin.role !== "OWNER") throw new AuthError("Only the owner can do this.", 403);
  return admin;
}

/** Route handlers that change data must be called from this site's own pages. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    const o = new URL(origin);
    return o.host === host || o.origin === new URL(site.url).origin;
  } catch {
    return false;
  }
}

/** Constant-time comparison for shared secrets (cron). */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected || expected.length < 16) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
