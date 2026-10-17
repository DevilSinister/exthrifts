import type { Metadata, Viewport } from "next";
import { Archivo, Courier_Prime } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

// Archivo's width axis gives one family both the condensed stamped headings
// and the regular body; Courier Prime sets hang-tag facts.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — one of one vintage, cash on delivery`, template: `%s · ${site.name}` },
  description: `${site.name} sells hand-picked one-of-one vintage clothing across Pakistan with cash on delivery. Real measurements, honest condition, scheduled drops.`,
  applicationName: site.name,
  openGraph: { siteName: site.name, type: "website", locale: "en_PK", images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${courier.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
