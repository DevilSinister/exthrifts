import Link from "next/link";
import { Logo } from "@/components/Logo";

// Unmatched URLs outside the store's route group render here without the shop chrome.
export default function RootNotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-5 px-4 sm:px-6">
      <Link href="/" aria-label="Home">
        <Logo className="h-10 w-auto" />
      </Link>
      <h1 className="display text-5xl">This tag is missing</h1>
      <p className="text-ink-soft">There&apos;s nothing at this address.</p>
      <Link href="/shop" className="btn btn-ink">
        Go to the shop
      </Link>
    </div>
  );
}
