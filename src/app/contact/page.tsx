import type { Metadata } from "next";
import Link from "next/link";
import { RouteShell } from "@/components/route-shell";

export const metadata: Metadata = {
  title: "Contact | OCSCO Project Crimson",
  description: "Start a conversation with OCSCO.",
};

export default function ContactPage() {
  return (
    <RouteShell
      eyebrow="The next step"
      title="Bring us the thing that needs to work better."
      intro="Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well."
    >
      <section className="section-green route-section">
        <div className="shell route-detail-grid">
          <div>
            <p className="overline overline-dark">What happens next</p>
            <h2>A clear conversation before a proposal.</h2>
          </div>
          <div className="route-list">
            <p><strong>01 / Share the context.</strong> Tell us what is changing, where the friction is, and what better looks like.</p>
            <p><strong>02 / Find the shape.</strong> We clarify the opportunity, scope, and right next step.</p>
            <p><strong>03 / Build the plan.</strong> If there is a fit, we define the work and how it should move forward.</p>
            <a className="button button-dark" href="/contact">Start a conversation <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
      <section className="section-light route-section">
        <div className="shell route-placeholder">
          <p className="overline">Form workflow</p>
          <h2>A form will be added after the response owner and inquiry workflow are confirmed.</h2>
          <Link className="text-link" href="/">Return home <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </RouteShell>
  );
}
