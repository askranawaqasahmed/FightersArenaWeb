import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SectionHeader({ eyebrow, title, href, linkLabel }: { eyebrow: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="section-header">
      <div><div className="eyebrow">{eyebrow}</div><h2 className="section-title">{title}</h2></div>
      {href && <Link className="text-link" href={href}>{linkLabel ?? "View all"}<ArrowUpRight size={16} /></Link>}
    </div>
  );
}
