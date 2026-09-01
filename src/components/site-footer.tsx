import Link from "next/link";
import { Brand } from "./brand";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div><Brand /><p className="footer-copy">The competitive identity layer for gamers, teams, tournaments and sponsors across Pakistan—and beyond.</p></div>
          <div><div className="footer-title">Compete</div><div className="footer-links"><Link href="/tournaments">Tournaments</Link><Link href="/games">Games</Link><Link href="/gamers">Rankings</Link></div></div>
          <div><div className="footer-title">Platform</div><div className="footer-links"><Link href="/developers">API Docs</Link><Link href="/admin">Admin portal</Link><Link href="/login">Player login</Link></div></div>
          <div><div className="footer-title">Company</div><div className="footer-links"><a href="mailto:hello@efightersarena.com">Contact</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></div>
        </div>
        <div className="footer-bottom"><span>© 2026 eFightersArena. All rights reserved.</span><span>Built for the next generation of competition.</span></div>
      </div>
    </footer>
  );
}
