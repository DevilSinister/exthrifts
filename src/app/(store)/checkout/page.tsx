import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/CheckoutFlow";
import { PK_CITIES } from "@/lib/cities";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <h1 className="display mb-2 text-5xl sm:text-6xl">Checkout</h1>
      <p className="mb-8 text-ink-soft">Cash on delivery. You pay the rider when your parcel arrives.</p>
      <CheckoutView cities={PK_CITIES} />
    </div>
  );
}
