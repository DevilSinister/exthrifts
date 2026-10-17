"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar list. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center justify-between rounded-[3px] px-3 text-[0.9375rem] ${
                active ? "bg-ink font-semibold text-paper" : "hover:bg-sunken"
              }`}
            >
              {item.label}
              {item.badge ? (
                <span className={`tag-text rounded-full px-1.5 text-xs font-bold ${active ? "bg-paper text-ink" : "bg-ink text-paper"}`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Phone bottom bar: the four daily screens plus everything else under More. */
export function BottomNav({ primary, more }: { primary: NavItem[]; more: NavItem[] }) {
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);
  const moreActive = more.some((m) => isActive(pathname, m.href));

  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);

  return (
    <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-14 flex-col items-center justify-center label text-[0.6875rem] ${active ? "bg-ink text-paper" : ""}`}
              >
                {item.label}
                {item.badge ? (
                  <span className={`tag-text absolute right-2 top-1.5 rounded-full px-1.5 text-[0.6875rem] font-bold ${active ? "bg-paper text-ink" : "bg-ink text-paper"}`}>
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
        <li>
          <details ref={details} className="group h-14">
            <summary className={`flex h-14 cursor-pointer list-none flex-col items-center justify-center label text-[0.6875rem] ${moreActive ? "bg-ink text-paper" : ""}`}>
              More
            </summary>
            <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto border-t-2 border-ink bg-paper p-3 shadow-[0_-6px_0_rgba(13,13,12,0.08)]">
              <ul className="grid grid-cols-2 gap-2">
                {more.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      className={`flex min-h-12 items-center border-2 border-ink px-3 text-sm font-semibold ${isActive(pathname, item.href) ? "bg-ink text-paper" : "bg-card"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </li>
      </ul>
    </nav>
  );
}
