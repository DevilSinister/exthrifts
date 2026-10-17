"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import type { ActionState } from "@/lib/admin-action";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "/admin");
  const next = nextRaw.startsWith("/admin") && !nextRaw.startsWith("//") ? nextRaw : "/admin";
  if (!email || !password) return { error: "Enter your email and password." };
  const result = await login(email, password);
  if (!result.ok) return { error: result.error };
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}
