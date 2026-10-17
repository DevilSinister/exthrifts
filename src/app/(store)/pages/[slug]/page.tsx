import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

async function load(slug: string) {
  return db.page.findFirst({ where: { slug, isPublished: true } });
}

export async function generateMetadata({ params }: PageProps<"/pages/[slug]">): Promise<Metadata> {
  const page = await load((await params).slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.body.replace(/\s+/g, " ").slice(0, 155),
    alternates: { canonical: `/pages/${page.slug}` },
  };
}

/** Owner-written text: blank lines make paragraphs, a short line followed by text reads as a question/heading. */
export default async function ContentPage({ params }: PageProps<"/pages/[slug]">) {
  const page = await load((await params).slug);
  if (!page) notFound();
  const blocks = page.body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <h1 className="display mb-8 text-5xl sm:text-6xl">{page.title}</h1>
      <div className="flex flex-col gap-5 text-[1.0625rem] leading-relaxed text-ink-soft">
        {blocks.map((block, i) => {
          const [first, ...rest] = block.split("\n");
          if (rest.length && first.length < 90) {
            return (
              <section key={i}>
                <h2 className="mb-1 font-bold text-ink">{first}</h2>
                <p className="whitespace-pre-line">{rest.join("\n")}</p>
              </section>
            );
          }
          return (
            <p key={i} className="whitespace-pre-line">
              {block}
            </p>
          );
        })}
      </div>
      <p className="tag-text mt-10 text-xs text-muted">
        Last updated{" "}
        {new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(page.updatedAt)}
      </p>
    </article>
  );
}
