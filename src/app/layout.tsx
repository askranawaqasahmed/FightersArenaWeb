import type { Metadata } from "next";
import "./globals.css";
import "./arena.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "eFightersArena — Pakistan's Competitive Gaming Platform", template: "%s — eFightersArena" },
  description: "Verified gamer profiles, teams, sponsors, tournaments, standings and professional esports brackets.",
  openGraph: { title: "eFightersArena", description: "The arena belongs to the fearless.", images: ["/images/arena-hero.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
