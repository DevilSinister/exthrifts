import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AnnouncementBar } from "@/components/store/AnnouncementBar";
import { CartLink, CartProvider } from "@/components/store/cart";
import { menuCategories, nextAnnouncedDrop, recentlyLiveDrop } from "@/lib/catalog/queries";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";

// Stock, drops and the countdown depend on the database and the clock.
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const now = new Date();
  const [settings, categories, nextDrop, liveDrop, pages] = await Promise.all([
    getSettings(),
    menuCategories(),
    nextAnnouncedDrop(now),
    recentlyLiveDrop(now),
    db.page.findMany({
      where: { isPublished: true, showInFooter: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, title: true },
    }),
  ]);
  const socials = [
    ["Instagram", settings.store.instagram],
    ["TikTok", settings.store.tiktok],
    ["Facebook", settings.store.facebook],
  ].filter(([, href]) => href && /^https?:\/\//.test(href));

  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-paper focus:p-2">
        Skip to content
      </a>
      <AnnouncementBar
        siteName={site.name}
        text={settings.announcement.enabled ? settings.announcement.text : null}
        nextDrop={nextDrop ? { name: nextDrop.name, slug: nextDrop.slug, startsAtMs: nextDrop.startsAt.getTime() } : null}
        liveDrop={liveDrop ? { name: liveDrop.name, slug: liveDrop.slug, startsAtMs: liveDrop.startsAt.getTime() } : null}
        serverNowMs={now.getTime()}
      />

      <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label={`${site.name} home`}>
            <Logo className="h-9 w-auto sm:h-10" />
          </Link>
          <nav aria-label="Categories" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            <Link href="/shop" className="btn btn-ghost btn-sm">
              New in
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="btn btn-ghost btn-sm">
                {c.name}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            <form action="/shop" role="search" className="hidden sm:block">
              <label htmlFor="site-search" className="sr-only">
                Search
              </label>
              <input id="site-search" name="q" type="search" placeholder="Search pieces" className="field h-10 min-h-0 w-44 py-1 text-sm" />
            </form>
            <Link href="/shop?focus=search" className="btn btn-ghost btn-sm px-2.5 sm:hidden" aria-label="Search">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
            </Link>
            <CartLink />
          </div>
        </div>
        {/* Phones: categories as a swipeable row, always one tap away. */}
        <nav aria-label="Categories" className="no-scrollbar flex gap-2 overflow-x-auto border-t border-dashed border-rule px-4 py-2 lg:hidden">
          <Link href="/shop" className="chip shrink-0 px-3 py-1 text-[0.75rem]">
            New in
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={`/category/${c.slug}`} className="chip shrink-0 px-3 py-1 text-[0.75rem]">
              {c.name}
            </Link>
          ))}
        </nav>
      </header>

      <main id="main" className="min-h-[60vh]">
        {children}
      </main>

      <footer className="mt-20 bg-ink text-paper">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Logo inverted className="h-10 w-auto self-start" />
            <p className="max-w-sm text-sm text-paper/80">
              One-of-one vintage, picked by hand. Cash on delivery anywhere in Pakistan.
            </p>
            {socials.length > 0 && (
              <ul className="flex gap-4">
                {socials.map(([name, href]) => (
                  <li key={name}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="label underline-offset-4 hover:underline">
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="label mb-3 text-paper/70">Shop</h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/shop" className="hover:underline">
                  All pieces
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} className="hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="label mb-3 text-paper/70">Help</h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/track" className="hover:underline">
                  Track your order
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:underline">
                  Contact
                </Link>
              </li>
              {pages.map((p) => (
                <li key={p.slug}>
                  <Link href={`/pages/${p.slug}`} className="hover:underline">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-dashed border-paper/30">
          <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-paper/70 sm:px-6">
            © {now.getFullYear()} {site.name}. Cash on delivery only.
          </p>
        </div>
      </footer>
    </CartProvider>
  );
}
