import type { PageDocument, PageSectionDocument } from "@/lib/page-document";

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function ReadOnlyValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="admin-readonly-empty">Not provided</span>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="admin-readonly-list">
        {value.length > 0 ? value.map((item, index) => <li key={index}><ReadOnlyValue value={item} /></li>) : <li><span className="admin-readonly-empty">No items</span></li>}
      </ul>
    );
  }

  if (typeof value === "object") {
    return (
      <dl className="admin-readonly-nested">
        {Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => (
          <div key={key}>
            <dt>{formatLabel(key)}</dt>
            <dd><ReadOnlyValue value={nestedValue} /></dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span className="admin-readonly-empty">Not available</span>;
}

function ReadOnlySection({ section, idSuffix }: { section: PageSectionDocument; idSuffix: string }) {
  const sectionHeadingId = `page-document-${section.key}-${idSuffix}`;

  return (
    <section className="admin-readonly-section" aria-labelledby={sectionHeadingId}>
      <header className="admin-readonly-section-heading">
        <div>
          <p className="admin-kicker">Section {section.order + 1}</p>
          <h3 id={sectionHeadingId}>{formatLabel(section.key)}</h3>
        </div>
        <div className="admin-readonly-section-status">
          <span className={section.enabled ? "admin-status-ready" : "admin-status-muted"}>{section.enabled ? "Visible" : "Hidden"}</span>
          <span>Order {section.order + 1}</span>
        </div>
      </header>
      <dl className="admin-readonly-fields">
        {Object.entries(section.content as Record<string, unknown>).map(([key, value]) => (
          <div key={key}>
            <dt>{formatLabel(key)}</dt>
            <dd><ReadOnlyValue value={value} /></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ReadOnlySeoPanel({ document, idSuffix }: { document: PageDocument; idSuffix: string }) {
  const headingId = `page-document-seo-heading-${idSuffix}`;

  return (
    <section className="admin-readonly-panel" aria-labelledby={headingId}>
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">PageDocument SEO</p>
          <h2 id={headingId}>Search and sharing metadata</h2>
        </div>
        <span className="admin-status-muted">Read-only</span>
      </div>
      <dl className="admin-readonly-fields admin-readonly-seo-fields">
        <div><dt>Title</dt><dd>{document.seo.title}</dd></div>
        <div><dt>Description</dt><dd>{document.seo.description}</dd></div>
        <div><dt>Open Graph title</dt><dd>{document.seo.ogTitle || <span className="admin-readonly-empty">Not provided</span>}</dd></div>
        <div><dt>Open Graph description</dt><dd>{document.seo.ogDescription || <span className="admin-readonly-empty">Not provided</span>}</dd></div>
        <div><dt>Open Graph image</dt><dd>{document.seo.ogImageRef ? `${document.seo.ogImageRef.kind} / ${document.seo.ogImageRef.key}` : <span className="admin-readonly-empty">Not provided</span>}</dd></div>
      </dl>
    </section>
  );
}

export default function PageDocumentReadOnly({ document, idSuffix }: { document: PageDocument; idSuffix: string }) {
  const headingId = `page-document-${document.pageKey}-content-heading-${idSuffix}`;
  const sections = [...document.sections].sort((left, right) => left.order - right.order);

  return (
    <section className="admin-readonly-panel" aria-labelledby={headingId}>
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">PageDocument v{document.schemaVersion}</p>
          <h2 id={headingId}>Structured page content</h2>
        </div>
        <span className="admin-status-muted">Read-only</span>
      </div>
      <div className="admin-readonly-section-list">
        {sections.map((section) => <ReadOnlySection key={section.key} section={section} idSuffix={idSuffix} />)}
      </div>
    </section>
  );
}
