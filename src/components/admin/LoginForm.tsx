"use client";

import { useActionState, useEffect } from "react";
import { loginAction, type LoginState } from "@/app/admin/actions/auth";
import { stashDeviceTokenFromHash } from "@/components/admin/DevicePairing";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  // The Android app opens /admin#device=<token>; keep the token across sign-in.
  useEffect(() => stashDeviceTokenFromHash(), []);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5">
        <span className="label text-[0.8125rem]">Email</span>
        {/* Keyed on the returned email so React's post-action form reset keeps what was typed. */}
        <input key={state.email ?? ""} name="email" type="email" autoComplete="username" required defaultValue={state.email} className="field" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="label text-[0.8125rem]">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="field" />
      </label>
      {state.error && (
        <p className="text-sm font-bold" role="alert">
          ! {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-ink" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
