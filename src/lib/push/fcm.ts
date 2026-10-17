// Firebase Cloud Messaging HTTP v1 sender. The OAuth access token is minted
// from the service-account key with an RS256 JWT (no Google SDK needed) and
// cached until shortly before it expires.
import { SignJWT, importPKCS8 } from "jose";
import { classifyFcmResponse, type FcmOutcome } from "@/lib/push/rules";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccount: ServiceAccount | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

export function serviceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return (cachedAccount = null);
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return (cachedAccount = null);
    cachedAccount = {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      // hPanel may store the key with literal "\n" sequences.
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    console.error("[push] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    cachedAccount = null;
  }
  return cachedAccount;
}

export function pushConfigured(): boolean {
  return serviceAccount() !== null;
}

async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const key = await importPKCS8(account.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`oauth_${response.status}`);
  const json = (await response.json()) as { access_token: string; expires_in: number };
  // Cache for 50 minutes at most.
  cachedToken = { value: json.access_token, expiresAt: Date.now() + Math.min(json.expires_in, 3000) * 1000 };
  return json.access_token;
}

export interface SendResult {
  outcome: FcmOutcome;
  /** Short, non-sensitive code for the delivery row. */
  code: string;
}

/** Sends one data-only message. Never throws; failures come back as an outcome. */
export async function sendDataMessage(token: string, data: Record<string, string>): Promise<SendResult> {
  const account = serviceAccount();
  if (!account) return { outcome: "fatal", code: "not_configured" };
  try {
    const bearer = await accessToken(account);
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { token, data, android: { priority: "HIGH", ttl: "86400s" } },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => ({}));
    const outcome = classifyFcmResponse(response.status, body);
    if (response.status === 401) cachedToken = null;
    return { outcome, code: outcome === "sent" ? "ok" : `http_${response.status}` };
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("oauth_") ? error.message : "network";
    return { outcome: "retry", code };
  }
}
