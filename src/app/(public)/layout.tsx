import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="public-site"><SiteHeader /><main id="main-content">{children}</main><SiteFooter /></div>;
}
