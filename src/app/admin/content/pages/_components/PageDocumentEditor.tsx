"use client";

import { useActionState, useEffect, useMemo, useState, type FormEvent } from "react";
import AdminSelect from "@/app/admin/AdminSelect";
import AdminSubmitButton from "@/app/admin/AdminSubmitButton";
import {
  canEditSectionVisibility,
  getSectionMoveState,
  movePageDocumentSection,
  validatePageDocumentDraft,
} from "@/lib/page-document-editor";
import { getPageDefinition } from "@/lib/page-registry";
import type {
  PageDocument,
  PageSectionDocument,
  PageSectionKey,
  SafeCta,
  ServiceSlug,
} from "@/lib/page-document";
import {
  initialPageDocumentActionState,
  savePageDocumentDraft,
} from "../actions";

const SERVICE_OPTIONS: Array<{ slug: ServiceSlug; label: string }> = [
  { slug: "branding", label: "Branding" },
  { slug: "website-design-development", label: "Website design & development" },
  { slug: "custom-cms", label: "Custom CMS" },
  { slug: "crm-business-tools", label: "CRM & business tools" },
  { slug: "custom-web-applications", label: "Custom web applications" },
];

const ROUTE_OPTIONS = ["/", "/services", "/about", "/contact"] as const;
const ANCHOR_OPTIONS = ["#contact", "#contact-form"] as const;

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  required?: boolean;
  description?: string;
};

function TextField({ id, label, value, onChange, multiline = false, required = true, description }: TextFieldProps) {
  return (
    <label className="admin-page-editor-field" htmlFor={id}>
      <span>{label}{required ? " *" : ""}</span>
      {description ? <small>{description}</small> : null}
      {multiline ? (
        <textarea className="admin-input admin-textarea" id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={4} required={required} />
      ) : (
        <input className="admin-input" id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
      )}
    </label>
  );
}

function contentRecord(section: PageSectionDocument) {
  return section.content as unknown as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function CtaEditor({ idPrefix, label, cta, onChange }: { idPrefix: string; label: string; cta: SafeCta; onChange: (cta: SafeCta) => void }) {
  const options = cta.kind === "route" ? ROUTE_OPTIONS : ANCHOR_OPTIONS;
  return (
    <fieldset className="admin-page-editor-fieldset">
      <legend>{label}</legend>
      <div className="admin-page-editor-field-grid">
        <TextField id={`${idPrefix}-label`} label="Label" value={cta.label} onChange={(labelValue) => onChange({ ...cta, label: labelValue })} />
        <label className="admin-page-editor-field" htmlFor={`${idPrefix}-kind`}>
          <span>Destination type *</span>
          <AdminSelect
            id={`${idPrefix}-kind`}
            value={cta.kind}
            onChange={(event) => {
              const kind = event.target.value as SafeCta["kind"];
              onChange({ kind, label: cta.label, href: kind === "route" ? "/" : "#contact" } as SafeCta);
            }}
          >
            <option value="route">Approved route</option>
            <option value="anchor">Approved anchor</option>
          </AdminSelect>
        </label>
        <label className="admin-page-editor-field" htmlFor={`${idPrefix}-href`}>
          <span>Destination *</span>
          <AdminSelect id={`${idPrefix}-href`} value={cta.href} onChange={(event) => onChange({ ...cta, href: event.target.value } as SafeCta)}>
            {options.map((option) => <option key={option} value={option}>{option}</option>)}
          </AdminSelect>
        </label>
      </div>
    </fieldset>
  );
}

function TextItemsEditor({
  sectionKey,
  items,
  onChange,
}: {
  sectionKey: PageSectionKey;
  items: Array<{ title: string; body: string }>;
  onChange: (index: number, field: "title" | "body", value: string) => void;
}) {
  return (
    <div className="admin-page-editor-items">
      <div className="admin-page-editor-subheading">
        <strong>Approved items</strong>
        <small>Exactly three items are required by the PageDocument contract.</small>
      </div>
      {items.map((item, index) => (
        <fieldset className="admin-page-editor-item" key={`${sectionKey}-${index}`}>
          <legend>Item {index + 1}</legend>
          <TextField id={`${sectionKey}-${index}-title`} label="Title" value={stringValue(item.title)} onChange={(value) => onChange(index, "title", value)} />
          <TextField id={`${sectionKey}-${index}-body`} label="Body" value={stringValue(item.body)} onChange={(value) => onChange(index, "body", value)} multiline />
        </fieldset>
      ))}
    </div>
  );
}

function ServiceReferencesEditor({
  items,
  onChange,
}: {
  items: Array<{ service: { kind: "service"; slug: ServiceSlug }; ctaLabel: string }>;
  onChange: (index: number, field: "slug" | "ctaLabel", value: string) => void;
}) {
  return (
    <div className="admin-page-editor-items">
      <div className="admin-page-editor-subheading">
        <strong>Approved Service references</strong>
        <small>Service records remain authoritative in Services. This page controls reference order and CTA labels only.</small>
      </div>
      {items.map((item, index) => (
        <fieldset className="admin-page-editor-item" key={`home-service-${index}`}>
          <legend>Service {index + 1}</legend>
          <div className="admin-page-editor-field-grid">
            <label className="admin-page-editor-field" htmlFor={`home-service-${index}-slug`}>
              <span>Canonical Service *</span>
              <AdminSelect id={`home-service-${index}-slug`} value={item.service.slug} onChange={(event) => onChange(index, "slug", event.target.value)}>
                {SERVICE_OPTIONS.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}
              </AdminSelect>
            </label>
            <TextField id={`home-service-${index}-cta`} label="CTA label" value={item.ctaLabel} onChange={(value) => onChange(index, "ctaLabel", value)} />
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function SectionEditor({
  document,
  section,
  onChange,
}: {
  document: PageDocument;
  section: PageSectionDocument;
  onChange: (next: PageDocument) => void;
}) {
  const blueprint = getPageDefinition(document.pageKey).blueprint.find((candidate) => candidate.key === section.key);
  const content = contentRecord(section);
  const setField = (field: string, value: unknown) => {
    const next = structuredClone(document) as PageDocument;
    const target = next.sections.find((candidate) => candidate.key === section.key);
    if (!target) return;
    (target.content as unknown as Record<string, unknown>)[field] = value;
    onChange(next);
  };
  const setItem = (field: string, index: number, itemField: string, value: unknown) => {
    const next = structuredClone(document) as PageDocument;
    const target = next.sections.find((candidate) => candidate.key === section.key);
    if (!target) return;
    const items = (target.content as unknown as Record<string, unknown>)[field];
    if (!Array.isArray(items) || !items[index] || typeof items[index] !== "object") return;
    (items[index] as Record<string, unknown>)[itemField] = value;
    onChange(next);
  };
  const setCta = (field: string, cta: SafeCta, index?: number) => {
    const next = structuredClone(document) as PageDocument;
    const target = next.sections.find((candidate) => candidate.key === section.key);
    if (!target) return;
    const targetContent = target.content as unknown as Record<string, unknown>;
    if (typeof index === "number" && Array.isArray(targetContent[field])) {
      (targetContent[field] as unknown[])[index] = cta;
    } else {
      targetContent[field] = cta;
    }
    onChange(next);
  };
  const moveState = getSectionMoveState(document, section.key);
  const canHide = canEditSectionVisibility(document.pageKey, section.key);

  return (
    <fieldset className="admin-page-editor-section">
      <legend>
        <span>{blueprint?.label ?? section.key}</span>
        <small>{section.key}</small>
      </legend>
      <div className="admin-page-editor-section-heading">
        <div>
          <span className="admin-kicker">Section {section.order}</span>
          <strong>{canHide ? "Optional section" : "Required section"}</strong>
        </div>
        <div className="admin-page-editor-section-controls">
          {canHide ? (
            <label className="admin-page-editor-checkbox">
              <input type="checkbox" checked={section.enabled} onChange={(event) => {
                const next = structuredClone(document) as PageDocument;
                const target = next.sections.find((candidate) => candidate.key === section.key);
                if (target) target.enabled = event.target.checked;
                onChange(next);
              }} />
              <span>Show this section</span>
            </label>
          ) : <span className="admin-status-muted">Always visible</span>}
          {moveState.canMoveUp ? <button className="admin-button-secondary admin-order-button" type="button" onClick={() => onChange(movePageDocumentSection(document, section.key, "up"))}>Move up</button> : null}
          {moveState.canMoveDown ? <button className="admin-button-secondary admin-order-button" type="button" onClick={() => onChange(movePageDocumentSection(document, section.key, "down"))}>Move down</button> : null}
        </div>
      </div>
      <div className="admin-page-editor-fields">
        {section.key === "home_hero" ? (
          <>
            <TextField id="home-hero-eyebrow" label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value)} />
            <TextField id="home-hero-title" label="Headline" value={stringValue(content.title)} onChange={(value) => setField("title", value)} />
            <TextField id="home-hero-intro" label="Supporting copy" value={stringValue(content.intro)} onChange={(value) => setField("intro", value)} multiline />
            {(content.ctas as SafeCta[]).map((cta, index) => <CtaEditor key={`home-hero-cta-${index}`} idPrefix={`home-hero-cta-${index}`} label={`CTA ${index + 1}`} cta={cta} onChange={(value) => setCta("ctas", value, index)} />)}
          </>
        ) : null}
        {section.key === "home_intro" || section.key === "home_proof" ? (
          <>
            <TextField id={`${section.key}-eyebrow`} label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value)} />
            <TextField id={`${section.key}-heading`} label="Heading" value={stringValue(content.heading)} onChange={(value) => setField("heading", value)} />
            <TextField id={`${section.key}-body`} label="Supporting copy" value={stringValue(content.body)} onChange={(value) => setField("body", value)} multiline />
          </>
        ) : null}
        {section.key === "home_capabilities" ? (
          <>
            <TextField id="home-capabilities-eyebrow" label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value)} />
            <TextField id="home-capabilities-heading" label="Heading" value={stringValue(content.heading)} onChange={(value) => setField("heading", value)} />
            <TextField id="home-capabilities-note" label="Supporting copy" value={stringValue(content.note)} onChange={(value) => setField("note", value)} multiline />
            <ServiceReferencesEditor items={content.items as Array<{ service: { kind: "service"; slug: ServiceSlug }; ctaLabel: string }>} onChange={(index, field, value) => setItem("items", index, field === "slug" ? "service" : field, field === "slug" ? { kind: "service", slug: value } : value)} />
          </>
        ) : null}
        {section.key === "home_approach" || section.key === "about_principles" || section.key === "contact_process" ? (
          <>
            <TextField id={`${section.key}-eyebrow`} label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value)} />
            <TextField id={`${section.key}-heading`} label="Heading" value={stringValue(content.heading)} onChange={(value) => setField("heading", value)} />
            <TextItemsEditor sectionKey={section.key} items={content.items as Array<{ title: string; body: string }>} onChange={(index, field, value) => setItem("items", index, field, value)} />
            {section.key === "contact_process" ? <CtaEditor idPrefix="contact-process-cta" label="Process CTA" cta={content.cta as SafeCta} onChange={(value) => setCta("cta", value)} /> : null}
          </>
        ) : null}
        {section.key === "home_contact" ? (
          <>
            <TextField id="home-contact-eyebrow" label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value)} />
            <TextField id="home-contact-heading" label="Heading" value={stringValue(content.heading)} onChange={(value) => setField("heading", value)} />
            <TextField id="home-contact-body" label="Supporting copy" value={stringValue(content.body)} onChange={(value) => setField("body", value)} multiline />
            <CtaEditor idPrefix="home-contact-cta" label="Contact CTA" cta={content.cta as SafeCta} onChange={(value) => setCta("cta", value)} />
          </>
        ) : null}
        {section.key === "services_hero" || section.key === "about_hero" || section.key === "contact_hero" ? (
          <>
            <TextField id={`${section.key}-eyebrow`} label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value)} />
            <TextField id={`${section.key}-title`} label="Headline" value={stringValue(content.title)} onChange={(value) => setField("title", value)} />
            <TextField id={`${section.key}-intro`} label="Supporting copy" value={stringValue(content.intro)} onChange={(value) => setField("intro", value)} multiline />
          </>
        ) : null}
        {section.key === "services_capabilities" ? (
          <>
            <TextField id="services-capabilities-eyebrow" label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value || undefined)} required={false} />
            <TextField id="services-capabilities-heading" label="Heading" value={stringValue(content.heading)} onChange={(value) => setField("heading", value || undefined)} required={false} />
            <TextField id="services-capabilities-note" label="Supporting copy" value={stringValue(content.note)} onChange={(value) => setField("note", value || undefined)} multiline required={false} />
            <p className="admin-disclosure-note">Service cards are managed in <a href="/crimson-admin-control/services">Services</a>. This editor controls only the overview wrapper.</p>
          </>
        ) : null}
        {section.key === "about_people" ? (
          <>
            <TextField id="about-people-eyebrow" label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value)} />
            <TextField id="about-people-heading" label="Heading" value={stringValue(content.heading)} onChange={(value) => setField("heading", value)} />
            <CtaEditor idPrefix="about-people-cta" label="People CTA" cta={content.cta as SafeCta} onChange={(value) => setCta("cta", value)} />
            <p className="admin-disclosure-note">People records, portraits, roles, and biographies are not part of this contract.</p>
          </>
        ) : null}
        {section.key === "contact_form" ? (
          <>
            <TextField id="contact-form-eyebrow" label="Eyebrow" value={stringValue(content.eyebrow)} onChange={(value) => setField("eyebrow", value)} />
            <TextField id="contact-form-heading" label="Heading" value={stringValue(content.heading)} onChange={(value) => setField("heading", value)} />
            <TextField id="contact-form-intro" label="Supporting copy" value={stringValue(content.intro)} onChange={(value) => setField("intro", value)} multiline />
            <p className="admin-disclosure-note">The ContactForm fields, validation, honeypot, inquiry API, service options, and submission behavior remain code-controlled.</p>
          </>
        ) : null}
      </div>
    </fieldset>
  );
}

function ValidationSummary({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="admin-alert admin-page-editor-validation" role="alert" aria-live="polite">
      <strong>Review the PageDocument fields.</strong>
      <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
    </div>
  );
}

export default function PageDocumentEditor({ initialDocument }: { initialDocument: PageDocument }) {
  const [document, setDocument] = useState<PageDocument>(initialDocument);
  const [localIssues, setLocalIssues] = useState<string[]>([]);
  const baseline = useMemo(() => JSON.stringify(initialDocument), [initialDocument]);
  const serializedDocument = JSON.stringify(document);
  const dirty = serializedDocument !== baseline;
  const [actionState, formAction, pending] = useActionState(savePageDocumentDraft, initialPageDocumentActionState);
  const issues = localIssues.length > 0 ? localIssues : actionState.issues;

  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const result = validatePageDocumentDraft(document, document.pageKey);
    if (!result.success) {
      event.preventDefault();
      setLocalIssues(result.issues);
      return;
    }
    setLocalIssues([]);
  };

  return (
    <form className="admin-page-document-editor" action={formAction} onSubmit={handleSubmit} aria-describedby="page-document-editor-help">
      <input type="hidden" name="page_key" value={document.pageKey} />
      <input type="hidden" name="page_document" value={serializedDocument} readOnly />
      <p id="page-document-editor-help" className="admin-disclosure-note">Edit approved structured content only. Save Draft keeps the revision private; Publish and Restore are intentionally deferred.</p>
      {actionState.status === "success" ? <p className="admin-readonly-valid" role="status">{actionState.message}</p> : null}
      {actionState.status === "error" && actionState.issues.length === 0 ? <div className="admin-alert" role="alert"><strong>{actionState.message}</strong></div> : null}
      <ValidationSummary issues={issues} />

      <section className="admin-page-editor-seo" aria-labelledby="page-document-seo-editor-heading">
        <div className="admin-page-editor-subheading">
          <div>
            <p className="admin-kicker">Authoritative metadata</p>
            <h3 id="page-document-seo-editor-heading">Search and sharing metadata</h3>
          </div>
          <span className="admin-status-ready">PageDocument SEO</span>
        </div>
        <div className="admin-page-editor-field-grid">
          <TextField id="page-seo-title" label="SEO title" value={document.seo.title} onChange={(value) => setDocument((current) => ({ ...current, seo: { ...current.seo, title: value } }))} />
          <TextField id="page-seo-description" label="SEO description" value={document.seo.description} onChange={(value) => setDocument((current) => ({ ...current, seo: { ...current.seo, description: value } }))} multiline />
          <TextField id="page-seo-og-title" label="Open Graph title" value={document.seo.ogTitle ?? ""} onChange={(value) => setDocument((current) => ({ ...current, seo: { ...current.seo, ogTitle: value || undefined } }))} required={false} />
          <TextField id="page-seo-og-description" label="Open Graph description" value={document.seo.ogDescription ?? ""} onChange={(value) => setDocument((current) => ({ ...current, seo: { ...current.seo, ogDescription: value || undefined } }))} multiline required={false} />
        </div>
        <p className="admin-disclosure-note">Open Graph image: generated / default. Origin, metadataBase, canonical paths, hostnames, and arbitrary image URLs remain code-controlled.</p>
      </section>

      <section className="admin-page-editor-sections" aria-labelledby="page-document-sections-heading">
        <div className="admin-page-editor-subheading">
          <div>
            <p className="admin-kicker">Structured content</p>
            <h3 id="page-document-sections-heading">Approved sections</h3>
          </div>
          <span className="admin-status-muted">No freeform sections</span>
        </div>
        <div className="admin-page-editor-section-list">
          {[...document.sections].sort((left, right) => left.order - right.order).map((section) => (
            <SectionEditor key={section.key} document={document} section={section} onChange={(next) => { setDocument(next); setLocalIssues([]); }} />
          ))}
        </div>
      </section>

      <div className="admin-page-editor-actions">
        <div>
          <strong>{dirty ? "Unsaved changes" : "No unsaved changes"}</strong>
          <small>{pending ? "Validating and saving Draft…" : "Draft only · no publication action is available in Batch 2."}</small>
        </div>
        <AdminSubmitButton label="Save Draft" pendingLabel="Saving Draft…" />
      </div>
    </form>
  );
}
