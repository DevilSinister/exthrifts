"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin-action";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Admin form wrapper: runs a server action, shows its outcome next to the
 * submit button, marks invalid fields, and optionally asks for confirmation.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  pendingLabel = "Saving…",
  confirm,
  resetOnSuccess = false,
  className = "",
  submitClassName = "btn btn-ink",
  inline = false,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  className?: string;
  submitClassName?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) formRef.current?.reset();
  }, [state.at, state.ok, resetOnSuccess]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.querySelectorAll<HTMLElement>("[name]"))) {
      const name = el.getAttribute("name")!;
      if (state.fieldErrors?.[name]) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    }
  }, [state.at, state.fieldErrors]);

  const fieldList = state.fieldErrors ? Object.entries(state.fieldErrors) : [];

  return (
    <form
      ref={formRef}
      action={formAction}
      className={inline ? `flex flex-wrap items-center gap-2 ${className}` : `flex flex-col gap-4 ${className}`}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className={inline ? "contents" : "flex flex-wrap items-center gap-3"}>
        <button type="submit" className={submitClassName} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        <span aria-live="polite" className="text-sm">
          {!pending && state.ok && <span className="tag-text">✓ {state.ok}</span>}
          {!pending && state.error && <span className="font-bold">! {state.error}</span>}
        </span>
      </div>
      {!pending && fieldList.length > 0 && (
        <ul className="text-sm" role="alert">
          {fieldList.map(([name, message]) => (
            <li key={name}>
              <span className="font-bold">{name}:</span> {message}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

/** Labelled form field for admin forms. */
export function F({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="label text-[0.75rem]">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
