"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { emptyInsightsBody, type InsightsBody } from "@/lib/insights-body";
import { isValidInsightsSlug } from "@/lib/insights-slug";
import { saveInsightsDraft, updateInsightsSlug, type InsightsActionState } from "./actions";

type Taxonomy = {
  categories: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
};

type ComposerProps = {
  taxonomy: Taxonomy;
  article?: {
    id: string;
    slug: string;
    status: "draft";
    updatedAt: string;
    title: string;
    excerpt: string;
    body: InsightsBody;
    categoryId: string;
    tagIds: string[];
  };
};

const initialInsightsActionState: InsightsActionState = { status: "idle", message: "", issues: [] };

function actionMessage(state: InsightsActionState) {
  if (state.status === "conflict") return "Conflict — reload required.";
  return state.message;
}

function formatSavedAt(value?: string) {
  if (!value) return "Not saved yet";
  return `Saved ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value))}`;
}

function ToolbarButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return <button className="insights-toolbar-button" type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}>{label}</button>;
}

export default function InsightsComposer({ taxonomy, article }: ComposerProps) {
  const router = useRouter();
  const initial = article?.body ?? emptyInsightsBody();
  const [saveState, saveAction, savePending] = useActionState(saveInsightsDraft, initialInsightsActionState);
  const [slugState, slugAction, slugPending] = useActionState(updateInsightsSlug, initialInsightsActionState);
  const [title, setTitle] = useState(article?.title ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [categoryId, setCategoryId] = useState(article?.categoryId ?? "");
  const [tagIds, setTagIds] = useState(article?.tagIds ?? []);
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [persistedArticleId, setPersistedArticleId] = useState(article?.id ?? "");
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(article?.updatedAt ?? "");
  const [bodyJson, setBodyJson] = useState(() => JSON.stringify(initial));
  const [dirty, setDirty] = useState(false);
  const [clientIssue, setClientIssue] = useState("");
  const [linkIssue, setLinkIssue] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [linkEntryOpen, setLinkEntryOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, horizontalRule: false, strike: false, underline: false, link: false }),
      Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: "_blank", rel: "noreferrer noopener" } }),
      Placeholder.configure({ placeholder: "Write the Draft here…" }),
    ],
    content: initial.doc,
    editorProps: { attributes: { "aria-label": "Article body", "aria-describedby": "article-body-help" } },
    onUpdate: ({ editor: currentEditor }) => {
      setBodyJson(JSON.stringify({ schema: "insights-body", version: 1, doc: currentEditor.getJSON() }));
      setDirty(true);
    },
  });

  useEffect(() => {
    if (editor) {
      // The editor is the source of truth once it has mounted.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBodyJson(JSON.stringify({ schema: "insights-body", version: 1, doc: editor.getJSON() }));
    }
  }, [editor]);

  useEffect(() => {
    if (saveState.articleId && saveState.articleId !== persistedArticleId) {
      // Preserve a server-created identity if the follow-up Draft save needs a retry.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPersistedArticleId(saveState.articleId);
    }
    if (saveState.status === "saved") {
      // Server confirmation is the point at which local dirty state can safely clear.
      setDirty(false);
      if (saveState.updatedAt) setExpectedUpdatedAt(saveState.updatedAt);
      if (!article && saveState.articleId) router.replace(`/crimson-admin-control/insights/articles/${saveState.articleId}`);
    }
  }, [article, persistedArticleId, router, saveState]);

  useEffect(() => {
    if (slugState.status === "saved") {
      // The returned timestamp is the concurrency token for the next slug update.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (slugState.slug) setSlug(slugState.slug);
      if (slugState.updatedAt) setExpectedUpdatedAt(slugState.updatedAt);
    }
  }, [slugState]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function toggleTag(tagId: string) {
    setTagIds((current) => current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId]);
    setDirty(true);
  }

  function beginLink() {
    if (!editor) return;
    setLinkIssue("");
    setLinkEntryOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const href = linkHref.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(href)) { setLinkIssue("Use a full http(s) link."); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkHref("");
    setLinkEntryOpen(false);
    setLinkIssue("");
  }

  function cancelLink() {
    setLinkHref("");
    setLinkEntryOpen(false);
    setLinkIssue("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!title.trim()) {
      event.preventDefault();
      setClientIssue("Enter a Title before saving this Draft.");
      titleRef.current?.focus();
      return;
    }
    setClientIssue("");
  }

  const saveFeedback = saveState.status === "error" || saveState.status === "conflict" ? saveState : null;
  const slugFeedback = slugState.status === "error" || slugState.status === "conflict" ? slugState : null;

  return (
    <div className="insights-composer-layout">
      <form className="insights-composer" action={saveAction} onSubmit={handleSubmit}>
        <input type="hidden" name="article_id" value={persistedArticleId} />
        <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
        <input type="hidden" name="body" value={bodyJson} readOnly />
        <div className="insights-writing-fields">
          <label className="insights-field insights-title-field">
            <span>Title</span>
            <input ref={titleRef} className="insights-title-input" name="title" value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} maxLength={160} placeholder="Give this article a clear working title" aria-invalid={Boolean(clientIssue)} aria-describedby={clientIssue ? "title-error" : undefined} />
          </label>
          {clientIssue ? <p className="insights-field-error" id="title-error" role="alert">{clientIssue}</p> : null}
          <div className="insights-editor-block">
            <div className="insights-field-heading"><span className="insights-field-label">Body</span><span id="article-body-help">Text-first editor. Images, embeds, and HTML are not available in this Draft foundation.</span></div>
            <div className="insights-toolbar" aria-label="Text formatting">
              <ToolbarButton label="H2" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} disabled={!editor} />
              <ToolbarButton label="H3" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} disabled={!editor} />
              <ToolbarButton label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} disabled={!editor} />
              <ToolbarButton label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={!editor} />
              <ToolbarButton label="Link" onClick={beginLink} disabled={!editor} />
              <ToolbarButton label="Bulleted list" onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={!editor} />
              <ToolbarButton label="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={!editor} />
              <ToolbarButton label="Blockquote" onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={!editor} />
              <span className="insights-toolbar-spacer" />
              <ToolbarButton label="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor} />
              <ToolbarButton label="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor} />
            </div>
            {linkEntryOpen ? <div className="insights-link-entry"><label><span>Link URL</span><input aria-label="Link URL" value={linkHref} onChange={(event) => setLinkHref(event.target.value)} placeholder="https://example.com" inputMode="url" autoFocus /></label><button type="button" className="button button-light" onClick={applyLink}>Apply link</button><button type="button" className="button button-light" onClick={cancelLink}>Cancel</button></div> : null}
            <div id="article-body-editor" className="insights-editor-surface"><EditorContent editor={editor} /></div>
            {linkIssue ? <p className="insights-field-error" role="alert">{linkIssue}</p> : null}
          </div>
          <label className="insights-field">
            <span>Excerpt <small>Optional · max 300 characters</small></span>
            <textarea name="excerpt" value={excerpt} onChange={(event) => { setExcerpt(event.target.value); setDirty(true); }} maxLength={300} placeholder="A short introduction for article lists" />
          </label>
        </div>

        <aside className="insights-metadata-panel" aria-label="Article metadata">
          <div className="insights-panel-heading"><div><p className="admin-kicker admin-kicker-green">Draft metadata</p><h2>Make it findable.</h2></div><span>Optional until review</span></div>
          <label className="insights-field"><span>Primary Category</span><select name="category_id" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setDirty(true); }}><option value="">No category yet</option>{taxonomy.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <fieldset className="insights-tags-field"><legend>Tags <small>Optional</small></legend>{taxonomy.tags.length ? <div className="insights-tag-grid">{taxonomy.tags.map((tag) => <label className="insights-check" key={tag.id}><input type="checkbox" name="tag_ids" value={tag.id} checked={tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} /><span>{tag.name}</span></label>)}</div> : <p className="insights-muted">No approved Tags are available yet.</p>}</fieldset>
          {saveFeedback ? <div className="insights-error" role="alert"><strong>{actionMessage(saveFeedback)}</strong>{saveFeedback.issues.length ? <ul>{saveFeedback.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}</div> : null}
          {saveState.status === "saved" ? <div className="insights-success" role="status">{saveState.message} <span>{formatSavedAt(saveState.savedAt)}</span></div> : null}
          <div className="insights-save-row"><div className="insights-save-copy" aria-live="polite"><strong>{savePending ? "Saving…" : dirty ? "Unsaved changes" : formatSavedAt(saveState.savedAt)}</strong><span>{saveState.status === "conflict" ? "The server changed this Draft." : "Explicit Save Draft only; no autosave."}</span></div><button className="button button-primary insights-save-button" type="submit" disabled={savePending || saveState.status === "saved" && !dirty}>{savePending ? "Saving…" : "Save Draft"} <span aria-hidden="true">↗</span></button></div>
        </aside>
      </form>

      {article ? <details className="insights-advanced"><summary>Advanced: slug</summary><div className="insights-advanced-body"><p>Keep this stable once the article is published. The server remains authoritative for ownership, Draft status, concurrency, and uniqueness.</p><form action={slugAction} className="insights-slug-form"><input type="hidden" name="article_id" value={article.id} /><input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} /><label className="insights-field"><span>Slug</span><input name="slug" value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={120} aria-describedby="slug-help" /></label><span id="slug-help" className="insights-muted">Lowercase letters, numbers, and hyphens.</span><button className="button button-light insights-slug-button" type="submit" disabled={slugPending || !isValidInsightsSlug(slug) || slugState.status === "saved" && slug === article.slug}>{slugPending ? "Updating…" : "Update slug"}</button></form>{slugFeedback ? <div className="insights-error" role="alert">{actionMessage(slugFeedback)}</div> : null}{slugState.status === "saved" ? <div className="insights-success" role="status">Slug updated.</div> : null}</div></details> : null}
    </div>
  );
}
