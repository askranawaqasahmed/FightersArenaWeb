import type { Metadata } from "next";
import "./overlay.css";

export const metadata: Metadata = {
  title: "Stream Overlay",
  robots: { index: false, follow: false },
};

export default function OverlayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="overlay-root">{children}</div>;
}
