"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import type { ActionState } from "@/lib/admin-action";

export type LoginState = ActionState & { email?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/admin");
  const next = nextRaw.startsWith("/admin") && !nextRaw.startsWith("//") ? nextRaw : "/admin";
  if (!email || !password) return { error: "Enter your email and password.", email };
  const result = await login(email, password);
  if (!result.ok) return { error: result.error, email };
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}
