import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer section-dark">
      <div className="shell footer-layout">
        <div className="footer-top">
          <Link className="brand brand-footer" href="/" aria-label="OCSCO home">
            <Image src="/brand/ocsco-logo-white.svg" alt="OCSCO" width={118} height={24} />
          </Link>
          <p className="footer-copy">Strategy, design, and technology for brands ready to move with precision.</p>
          <span className="footer-meta">Project Crimson / 2026</span>
        </div>
        <div className="footer-bottom">
          <span>OCSCO / Strategy · Design · Technology</span>
          <Link className="footer-link" href="/contact">Start a conversation <ArrowUpRight aria-hidden="true" size={15} strokeWidth={2} /></Link>
        </div>
      </div>
    </footer>
  );
}
