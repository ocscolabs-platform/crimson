import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type SiteFooterProps = {
  positioningStatement?: string;
  ctaHref?: string;
};

export function SiteFooter({
  positioningStatement = "Strategy, design, and technology for brands ready to move with precision.",
  ctaHref = "/contact",
}: SiteFooterProps) {
  return (
    <footer className="site-footer section-dark">
      <div className="shell footer-layout">
        <div className="footer-top">
          <div className="footer-brand-block">
            <Link className="brand brand-footer" href="/" aria-label="OCSCO home">
              <Image src="/brand/ocsco-logo-white.svg" alt="OCSCO" width={118} height={24} />
            </Link>
            <p className="footer-copy">{positioningStatement}</p>
          </div>
          <Link className="footer-link footer-top-cta" href={ctaHref}>Start a conversation <ArrowUpRight aria-hidden="true" size={15} strokeWidth={2} /></Link>
        </div>
        <div className="footer-bottom">
          <span>OCSCO / Strategy · Design · Technology</span>
          <span className="footer-rights">All rights reserved · OCSCO.IO / 2026</span>
        </div>
      </div>
    </footer>
  );
}
