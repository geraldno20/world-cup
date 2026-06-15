import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Pool",
  description: "World Cup prediction pool — drafted teams, points leaderboard.",
  applicationName: "World Cup Pool",
  appleWebApp: {
    capable: true,
    title: "World Cup Pool",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1f",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <header className="border-b border-[var(--border)] px-4 md:px-8 py-4 flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            World Cup Pool
          </Link>
          <nav className="flex gap-4 text-sm text-[var(--fg-muted)]">
            <Link href="/" className="hover:text-[var(--fg)]">
              Leaderboard
            </Link>
            <Link href="/matches" className="hover:text-[var(--fg)]">
              Matches
            </Link>
          </nav>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </body>
    </html>
  );
}
