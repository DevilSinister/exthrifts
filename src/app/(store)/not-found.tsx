import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-5 px-4 pt-16 sm:px-6">
      <span className="stamp text-3xl">Not found</span>
      <h1 className="display text-5xl">This tag is missing</h1>
      <p className="text-ink-soft">The page or piece you&apos;re after isn&apos;t on the rack. It may have sold a while ago.</p>
      <Link href="/shop" className="btn btn-ink">
        See what&apos;s in
      </Link>
    </div>
  );
}
