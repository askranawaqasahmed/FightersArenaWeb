import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="eFightersArena home">
      <span className="brand-mark" aria-hidden="true">E</span>
      {!compact && <span className="brand-name">eFighters<span>Arena</span></span>}
    </Link>
  );
}
