import Link from "next/link";
import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="eFightersArena home">
      <Image className="brand-logo" src="/images/fighters-arena-logo.png" alt="" width={48} height={50} />
      {!compact && <span className="brand-name">eFighters<span>Arena</span></span>}
    </Link>
  );
}
