import Link from "next/link";
import Image from "next/image";
import { Blocks, Layers3, PanelsTopLeft, PenTool, Workflow } from "lucide-react";

export default function Home() {
  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <header className="site-header shell">
          <a className="brand" href="#top" aria-label="OCSCO home">
            <Image src="/brand/ocsco-logo-white.svg" alt="OCSCO" width={118} height={24} priority />
          </a>
          <nav className="primary-nav" aria-label="Primary navigation">
            <Link href="/services">Services</Link>
            <Link href="/work">Work</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </nav>
          <a className="button button-small button-outline-light header-cta" href="#contact">
            Start a conversation
          </a>
        </header>

        <div className="hero-content shell" id="top">
          <p className="overline overline-green">Strategy / Design / Technology</p>
          <h1 id="hero-title">Digital infrastructure for brands ready to move with precision.</h1>
          <div className="hero-bottom">
            <p className="hero-copy">
              OCSCO integrates strategy, design, and technology to build digital systems
              that make ambitious businesses clearer, stronger, and ready for what comes next.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#contact">Start a conversation <span aria-hidden="true">↗</span></a>
              <Link className="text-link text-link-light" href="/services">Explore the capabilities <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <span className="hero-glass hero-glass-one" />
          <span className="hero-glass hero-glass-two" />
          <span className="hero-glass hero-glass-three" />
        </div>
        <div className="hero-noise" aria-hidden="true" />
      </section>

      <section className="intro-section section-light" aria-labelledby="intro-title">
        <div className="shell split-intro">
          <p className="overline">The work</p>
          <div>
            <h2 id="intro-title">A sharper digital presence starts with a better system.</h2>
            <p className="lead-copy">
              Your brand, website, and internal tools should reinforce one another. We bring
              the thinking and execution together so every part of the experience moves in the
              same direction.
            </p>
          </div>
        </div>
      </section>

      <section className="capabilities section-snow" id="capabilities" aria-labelledby="capabilities-title">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="overline">Capabilities</p>
              <h2 id="capabilities-title">Built as a system.<br />Delivered with intent.</h2>
            </div>
            <p className="section-note">Five connected capabilities. One clear standard: the work has to perform.</p>
          </div>
          <div className="capability-grid">
            <article className="capability-card">
              <span className="card-number">01</span>
              <PenTool className="capability-icon" aria-hidden="true" size={24} strokeWidth={1.6} />
              <h3>Branding</h3>
              <p>Positioning and identity systems that give the quality of your business a clear, credible expression.</p>
              <a className="card-link" href="#contact">Discuss branding <span aria-hidden="true">↗</span></a>
            </article>
            <article className="capability-card">
              <span className="card-number">02</span>
              <PanelsTopLeft className="capability-icon" aria-hidden="true" size={24} strokeWidth={1.6} />
              <h3>Website design &amp; development</h3>
              <p>High-performing digital experiences that turn clarity into trust and trust into momentum.</p>
              <a className="card-link" href="#contact">Discuss a website <span aria-hidden="true">↗</span></a>
            </article>
            <article className="capability-card">
              <span className="card-number">03</span>
              <Layers3 className="capability-icon" aria-hidden="true" size={24} strokeWidth={1.6} />
              <h3>Custom CMS</h3>
              <p>Content systems shaped around how your team actually works, publishes, and grows.</p>
              <a className="card-link" href="#contact">Discuss a content system <span aria-hidden="true">↗</span></a>
            </article>
            <article className="capability-card">
              <span className="card-number">04</span>
              <Workflow className="capability-icon" aria-hidden="true" size={24} strokeWidth={1.6} />
              <h3>CRM &amp; business tools</h3>
              <p>Purpose-built workflows that reduce friction and help your team operate with more signal.</p>
              <a className="card-link" href="#contact">Discuss a business tool <span aria-hidden="true">↗</span></a>
            </article>
            <article className="capability-card capability-card-wide">
              <span className="card-number">05</span>
              <Blocks className="capability-icon" aria-hidden="true" size={24} strokeWidth={1.6} />
              <h3>Custom web applications</h3>
              <p>When an off-the-shelf answer is not enough, we architect the application your process needs.</p>
              <a className="card-link" href="#contact">Discuss an application <span aria-hidden="true">↗</span></a>
            </article>
          </div>
        </div>
      </section>

      <section className="approach section-dark" id="approach" aria-labelledby="approach-title">
        <div className="shell approach-layout">
          <div>
            <p className="overline overline-green">How we work</p>
            <h2 id="approach-title">Clarity first.<br />Craft all the way through.</h2>
          </div>
          <div className="approach-list">
            <div className="approach-item">
              <span className="card-number card-number-green">01</span>
              <div><h3>Understand the real problem</h3><p>We start with the business context, not a predetermined deliverable.</p></div>
            </div>
            <div className="approach-item">
              <span className="card-number card-number-green">02</span>
              <div><h3>Architect the right system</h3><p>Strategy, design, and technology align around the outcome that matters.</p></div>
            </div>
            <div className="approach-item">
              <span className="card-number card-number-green">03</span>
              <div><h3>Build with precision</h3><p>Senior-level thinking stays close to the work from first decision to final detail.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-note section-light" aria-labelledby="proof-title">
        <div className="shell proof-layout">
          <p className="overline">Proof of work</p>
          <div>
            <h2 id="proof-title">The work deserves the space to speak for itself.</h2>
            <p className="lead-copy">Selected case studies will be added here as projects, outcomes, and publication permissions are approved.</p>
          </div>
        </div>
      </section>

      <section className="contact-cta section-green" id="contact" aria-labelledby="contact-title">
        <div className="shell contact-layout">
          <p className="overline overline-dark">The next step</p>
          <div>
            <h2 id="contact-title">Bring us the thing that needs to work better.</h2>
            <p className="contact-copy">Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well.</p>
            <a className="button button-dark" href="mailto:ocscolabs@gmail.com">Email OCSCO <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>

      <footer className="site-footer section-dark">
        <div className="shell footer-layout">
          <a className="brand brand-footer" href="#top" aria-label="Back to top"><Image src="/brand/ocsco-logo-white.svg" alt="OCSCO" width={118} height={24} /></a>
          <p>Strategy, design, and technology for brands ready to move with precision.</p>
          <span className="footer-meta">Project Crimson / 2026</span>
        </div>
      </footer>
    </main>
  );
}
