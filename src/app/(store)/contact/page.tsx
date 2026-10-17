import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { displayPhone, normalizePkPhone, whatsappLink } from "@/lib/phone";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const { store } = await getSettings();
  const whatsapp = normalizePkPhone(store.whatsapp);
  const phone = normalizePkPhone(store.phone);
  const channels = [
    whatsapp && { label: "WhatsApp", value: displayPhone(whatsapp), href: whatsappLink(whatsapp, "Hi!") },
    phone && { label: "Call", value: displayPhone(phone), href: `tel:${phone}` },
    store.email && { label: "Email", value: store.email, href: `mailto:${store.email}` },
    /^https?:\/\//.test(store.instagram) && { label: "Instagram", value: "Message us on Instagram", href: store.instagram },
  ].filter(Boolean) as Array<{ label: string; value: string; href: string }>;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <h1 className="display text-5xl sm:text-6xl">Contact</h1>
      <p className="mt-3 text-ink-soft">Questions about a piece, sizing or your order — reach us here.</p>
      {channels.length ? (
        <ul className="mt-8 flex flex-col border-2 border-ink bg-card">
          {channels.map((c, i) => (
            <li key={c.label} className={i ? "border-t-2 border-dashed border-ink" : ""}>
              <a
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex min-h-16 items-center justify-between gap-4 px-5 hover:bg-sunken"
              >
                <span className="label">{c.label}</span>
                <span className="tag-text">{c.value}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 border-2 border-dashed border-rule p-6 text-muted">Contact details are coming soon.</p>
      )}
    </div>
  );
}
