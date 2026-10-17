import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const next = safeNext((await searchParams).next);
  if (await getAdmin()) redirect(next);
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo className="mx-auto mb-8 h-11 w-auto" />
        <div className="border-2 border-ink bg-card p-6 shadow-[5px_6px_0_rgba(13,13,12,0.9)]">
          <h1 className="display mb-1 text-4xl">Back office</h1>
          <p className="mb-6 text-sm text-muted">Sign in to manage orders, pieces and drops.</p>
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
