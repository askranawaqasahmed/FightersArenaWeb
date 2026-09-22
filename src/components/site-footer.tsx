import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";

export function SiteFooter() {
  return <footer className="footer"><div className="container">
    <div className="footer-grid">
      <div><Brand /><p className="footer-copy">For the love of the game.<br />The home of competitive fighting games in Pakistan. Find your people. Make your mark.</p><span className="footer-location">PAKISTAN · CONNECTED BY COMPETITION</span></div>
      <div><div className="footer-title">Explore</div><div className="footer-links"><Link href="/games">Game library</Link><Link href="/tournaments">Tournaments</Link><Link href="/gamers">Player directory</Link></div></div>
      <div><div className="footer-title">Your arena</div><div className="footer-links"><Link href="/login">Join the community <ArrowUpRight size={12} /></Link><Link href="/dashboard">Player dashboard</Link><Link href="/admin">Organizer portal</Link></div></div>
      <div><div className="footer-title">Connect</div><div className="footer-links"><a href="mailto:hello@efightersarena.com">Get in touch</a><Link href="/developers">Developer API</Link><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms of service</Link></div></div>
    </div>
    <div className="footer-bottom"><span>© 2026 eFightersArena. All rights reserved.</span><span>Play with purpose. Compete with respect.</span></div>
  </div></footer>;
}
