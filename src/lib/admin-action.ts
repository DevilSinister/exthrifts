// Shared shape for admin form actions, used with useActionState.
import { z } from "zod";
import { AuthError } from "@/lib/auth";
import { OrderActionError } from "@/lib/orders/service";
import { UploadError } from "@/lib/images/storage";

export interface ActionState {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every result so forms can react (reset, close) even when the message repeats. */
  at?: number;
}

export class UserError extends Error {}

/** Turns known errors into a message for the person at the form; logs and hides the rest. */
export async function run(work: () => Promise<string | void>): Promise<ActionState> {
  try {
    const message = await work();
    return { ok: message || "Saved.", at: Date.now() };
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return { error: "Check the highlighted fields.", fieldErrors, at: Date.now() };
    }
    if (
      error instanceof UserError ||
      error instanceof AuthError ||
      error instanceof OrderActionError ||
      error instanceof UploadError
    ) {
      return { error: error.message, at: Date.now() };
    }
    const code = (error as { code?: string })?.code;
    if (code === "P2002") return { error: "That already exists. Use a different name, code or slug.", at: Date.now() };
    console.error("[admin action] failed", { code, message: error instanceof Error ? error.message : String(error) });
    return { error: "Something went wrong. Nothing was saved — try again.", at: Date.now() };
  }
}

function isRedirect(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"));
}

/** FormData helpers. Empty strings become null/undefined. */
export const fd = {
  str(form: FormData, key: string): string {
    return String(form.get(key) ?? "").trim();
  },
  opt(form: FormData, key: string): string | null {
    const v = String(form.get(key) ?? "").trim();
    return v ? v : null;
  },
  int(form: FormData, key: string): number | null {
    const v = String(form.get(key) ?? "").trim().replace(/,/g, "");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  },
  num(form: FormData, key: string): number | null {
    const v = String(form.get(key) ?? "").trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  },
  bool(form: FormData, key: string): boolean {
    const v = form.get(key);
    return v === "on" || v === "true" || v === "1";
  },
  list(form: FormData, key: string): string[] {
    return form.getAll(key).map((v) => String(v)).filter(Boolean);
  },
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
