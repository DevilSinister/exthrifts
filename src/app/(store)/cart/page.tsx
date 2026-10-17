import type { Metadata } from "next";
import { CartView } from "@/components/store/CheckoutFlow";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      <h1 className="display mb-6 text-5xl sm:text-6xl">Your cart</h1>
      <CartView />
    </div>
  );
}
