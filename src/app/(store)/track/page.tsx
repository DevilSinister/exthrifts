import type { Metadata } from "next";
import { TrackForm } from "@/components/store/TrackForm";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check where your parcel is with your order number and phone number.",
  alternates: { canonical: "/track" },
};

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-10 sm:px-6">
      <h1 className="display text-5xl sm:text-6xl">Track your order</h1>
      <p className="mt-3 text-ink-soft">Enter the order number from your confirmation and the phone number you ordered with.</p>
      <TrackForm />
    </div>
  );
}
