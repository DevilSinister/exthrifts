import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BottomNav, SideNav, type NavItem } from "@/components/admin/AdminNav";
import { DevicePairing } from "@/components/admin/DevicePairing";
import { logoutAction } from "@/app/admin/actions/auth";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: `%s · ${site.name} admin` }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const newOrders = await db.order.count({ where: { status: "PENDING" } });

  const daily: NavItem[] = [
    { href: "/admin", label: "Home" },
    { href: "/admin/orders", label: "Orders", badge: newOrders },
    { href: "/admin/products", label: "Pieces" },
    { href: "/admin/drops", label: "Drops" },
  ];
  const rest: NavItem[] = [
    { href: "/admin/inventory", label: "Inventory" },
    { href: "/admin/catalog", label: "Categories & collections" },
    { href: "/admin/coupons", label: "Coupons" },
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/storefront", label: "Storefront & pages" },
    { href: "/admin/settings", label: "Settings" },
    { href: "/admin/prints", label: "Print history" },
    { href: "/admin/devices", label: "Alert phones" },
    ...(admin.role === "OWNER" ? [{ href: "/admin/team", label: "Team" }] : []),
    { href: "/admin/activity", label: "Activity" },
  ];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto border-r-2 border-ink bg-paper p-4 md:flex">
        <Link href="/admin" aria-label="Admin home">
          <Logo className="h-9 w-auto" />
        </Link>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-5">
          <SideNav items={daily} />
          <hr className="tear" />
          <SideNav items={rest} />
        </nav>
        <div className="flex flex-col gap-2 border-t-2 border-dashed border-rule pt-4 text-sm">
          <p className="truncate">
            {admin.name} <span className="chip chip-muted ml-1">{admin.role.toLowerCase()}</span>
          </p>
          <div className="flex gap-2">
            <Link href="/" className="btn btn-line btn-sm" target="_blank">
              View shop
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost btn-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-2 border-ink bg-paper/95 px-4 backdrop-blur-sm md:hidden">
          <Link href="/admin" aria-label="Admin home">
            <Logo className="h-8 w-auto" />
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost btn-sm">
              Sign out
            </button>
          </form>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-8">{children}</main>
      </div>

      <BottomNav primary={daily} more={rest} />
      <DevicePairing />
    </div>
  );
}
