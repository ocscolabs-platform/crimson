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
            <div className="footer-social-links" aria-label="OCSCO social media">
              <a className="footer-social-link" href="https://www.instagram.com/ocscodotio/" target="_blank" rel="noopener noreferrer" aria-label="OCSCO on Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle className="footer-social-icon-fill" cx="17.5" cy="6.5" r="1" />
                </svg>
              </a>
              <a className="footer-social-link" href="https://www.facebook.com/ocscohq" target="_blank" rel="noopener noreferrer" aria-label="OCSCO on Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M14 22v-8h3l1-4h-4V7.5A1.5 1.5 0 0 1 15.5 6H18V2h-3a5 5 0 0 0-5 5v3H7v4h3v8Z" />
                </svg>
              </a>
              <a className="footer-social-link" href="https://ph.linkedin.com/company/ocsco" target="_blank" rel="noopener noreferrer" aria-label="OCSCO on LinkedIn">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect className="footer-social-icon-fill" x="3" y="9" width="4" height="12" />
                  <circle className="footer-social-icon-fill" cx="5" cy="5" r="2" />
                  <path d="M11 21V9h4v1.8A5 5 0 0 1 21 15v6h-4v-6a2 2 0 0 0-4 0v6Z" />
                </svg>
              </a>
            </div>
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
