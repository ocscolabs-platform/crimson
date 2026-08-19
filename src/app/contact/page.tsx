import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { RouteShell } from "@/components/route-shell";

export const metadata: Metadata = {
  title: "Contact",
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
            <a className="button button-dark" href="#contact-form">Start the conversation <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
        <section className="section-light route-section contact-form-section" id="contact-form">
        <div className="shell contact-form-layout">
          <div className="contact-form-intro">
            <p className="overline">Start the conversation</p>
            <h2>Tell us what needs to work better.</h2>
            <p className="route-copy">Share the context, the friction, and the opportunity. We will take it from there.</p>
          </div>
          <ContactForm />
        </div>
      </section>
    </RouteShell>
  );
}
