export default function Home() {
  return (
    <main className="foundation-shell">
      <div className="foundation-card">
        <p className="eyebrow">OCSCO Project Crimson</p>
        <h1>Platform foundation</h1>
        <p className="intro">
          The application shell is ready for the next approved phase. The public
          website, custom CMS, and custom CRM are intentionally not implemented yet.
        </p>
        <div className="status-row" aria-label="Foundation status">
          <span className="status-dot" aria-hidden="true" />
          <span>Phase 0 — infrastructure and documentation</span>
        </div>
      </div>
    </main>
  );
}
