import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "JetSet Rewards",
  description: "Track every credit, every card, before it expires.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-slate-200 antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6">
          {children}
        </main>
      </body>
    </html>
  );
}
