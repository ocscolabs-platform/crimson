import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { RouteShell } from "@/components/route-shell";

export const metadata: Metadata = {
  title: "Work | OCSCO Project Crimson",
  description: "Selected OCSCO work and case studies will be published here as they are approved.",
};

export default function WorkPage() {
  return (
    <RouteShell
      eyebrow="Proof of work"
      title="The work deserves the space to speak for itself."
      intro="Selected projects and case studies will be added as facts, outcomes, media, and publication permissions are approved."
    >
      <section className="section-light route-section">
        <div className="shell route-placeholder">
          <div className="media-placeholder" aria-label="Portfolio media placeholder">
            <ImageOff aria-hidden="true" size={28} strokeWidth={1.6} />
            <span>Approved project media will appear here</span>
          </div>
          <p className="overline">Work library</p>
          <h2>Case studies are being prepared.</h2>
          <p className="route-copy">No client names, metrics, testimonials, or project claims are published here until they are reviewed and approved.</p>
          <Link className="button button-dark" href="/contact">Discuss a project <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </RouteShell>
  );
}
