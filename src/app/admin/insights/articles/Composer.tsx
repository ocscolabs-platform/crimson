"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { emptyInsightsBody, stripResolvedInsightsMedia, type InsightsBody } from "@/lib/insights-body";
import { isValidInsightsSlug } from "@/lib/insights-slug";
import { createInsightsCategory, createInsightsTag, deleteInsightsCategory, deleteInsightsTag, publishInsightsArticle, removeInsightsMedia, saveInsightsDraft, submitInsightsForReview, updateInsightsMediaAlt, updateInsightsSlug, uploadInsightsMedia, type InsightsActionState, type InsightsCategoryActionState, type InsightsMediaActionState, type InsightsTagActionState } from "./actions";
import InsightsTaxonomyActionButton from "./InsightsTaxonomyActionButton";

const AUTOSAVE_DEBOUNCE_MS = 1750;
const AUTOSAVE_MIN_INTERVAL_MS = 5000;

type Taxonomy = { categories: Array<{ id: string; name: string }>; tags: Array<{ id: string; name: string }> };
type ComposerProps = {
  taxonomy: Taxonomy;
  role: "owner" | "editor";
  canPublishInsights: boolean;
  article?: { id: string; slug: string; status: "draft"; updatedAt: string; title: string; excerpt: string; body: InsightsBody; categoryId: string; tagIds: string[]; coverMedia: InsightsMedia | null; inlineMedia: InsightsMedia[] };
};
type InsightsMedia = { id: string; kind: "cover" | "inline"; altText: string; caption: string | null; width: number; height: number; previewUrl: string | null };
type SaveKind = "autosave" | "explicit";
type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";
type MediaAction = "upload" | "remove" | "save-alt";
type Snapshot = { articleId: string; expectedUpdatedAt: string; title: string; excerpt: string; categoryId: string; tagIds: string[]; bodyJson: string; version: number };

const initialActionState: InsightsActionState = { status: "idle", message: "", issues: [] };
const initialMediaState: InsightsMediaActionState = { status: "idle", message: "" };
const initialCategoryState: InsightsCategoryActionState = { status: "idle", message: "" };
const initialTagState: InsightsTagActionState = { status: "idle", message: "" };
const subscribeToNothing = () => () => {};

const InsightsImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      mediaId: { default: null },
      alt: { default: "" },
      caption: { default: null },
      src: { default: null },
    };
  },
  parseHTML() { return [{ tag: "img[data-insights-media]" }]; },
  renderHTML({ HTMLAttributes }) { return ["img", mergeAttributes({ "data-insights-media": "true" }, HTMLAttributes)]; },
});

function formatSavedAt(value?: string) {
  if (!value) return "Not saved yet";
  return `Saved ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value))}`;
}

function ToolbarButton({ label, onClick, onMouseDown, disabled = false }: { label: string; onClick: () => void; onMouseDown?: (event: ReactMouseEvent<HTMLButtonElement>) => void; disabled?: boolean }) {
  return <button className="insights-toolbar-button" type="button" onClick={onClick} onMouseDown={onMouseDown} disabled={disabled} aria-label={label} title={label}>{label}</button>;
}

function actionMessage(state: InsightsActionState) {
  if (state.status === "conflict") return "This article changed elsewhere. Reload latest saved version.";
  return state.message;
}

export default function InsightsComposer({ taxonomy, role, canPublishInsights, article }: ComposerProps) {
  const router = useRouter();
  const initial = article?.body ?? emptyInsightsBody();
  const persistedInitial = stripResolvedInsightsMedia(initial);
  const [title, setTitle] = useState(article?.title ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [categoryId, setCategoryId] = useState(article?.categoryId ?? "");
  const [tagIds, setTagIds] = useState(article?.tagIds ?? []);
  const [categories, setCategories] = useState(taxonomy.categories);
  const [categoryName, setCategoryName] = useState("");
  const [categoryFeedback, setCategoryFeedback] = useState(initialCategoryState);
  const [tags, setTags] = useState(taxonomy.tags);
  const [tagName, setTagName] = useState("");
  const [tagFeedback, setTagFeedback] = useState(initialTagState);
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [bodyJson, setBodyJson] = useState(() => JSON.stringify(persistedInitial));
  const [dirty, setDirty] = useState(!article);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(article ? "saved" : "dirty");
  const [saveState, setSaveState] = useState<InsightsActionState>(initialActionState);
  const [lastSavedAt, setLastSavedAt] = useState(article?.updatedAt);
  const hasMounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  async function handleCreateCategory() {
    const data = new FormData();
    data.set("category_name", categoryName);
    const result = await createInsightsCategory(initialCategoryState, data);
    setCategoryFeedback(result);
    if (result.status === "saved" && result.category) {
      setCategories((current) => [...current, result.category!].sort((left, right) => left.name.localeCompare(right.name)));
      setCategoryId(result.category.id);
      setCategoryName("");
      markDirty();
    }
  }
  async function handleDeleteCategory() {
    const data = new FormData();
    data.set("category_id", categoryId);
    const result = await deleteInsightsCategory(initialCategoryState, data);
    setCategoryFeedback(result);
    if (result.status === "saved") {
      setCategories((current) => current.filter((category) => category.id !== categoryId));
      setCategoryId("");
      markDirty();
    }
  }
  async function handleCreateTag() {
    const data = new FormData();
    data.set("tag_name", tagName);
    const result = await createInsightsTag(initialTagState, data);
    setTagFeedback(result);
    if (result.status === "saved" && result.tag) {
      setTags((current) => [...current, result.tag!].sort((left, right) => left.name.localeCompare(right.name)));
      setTagName("");
    }
  }
  async function handleDeleteTag() {
    const selectedTagId = tagIds[0];
    if (!selectedTagId) {
      setTagFeedback({ status: "error", message: "Select one Tag to delete." });
      return;
    }
    const data = new FormData();
    data.set("tag_id", selectedTagId);
    const result = await deleteInsightsTag(initialTagState, data);
    setTagFeedback(result);
    if (result.status === "saved") {
      setTags((current) => current.filter((tag) => tag.id !== selectedTagId));
      setTagIds((current) => current.filter((tagId) => tagId !== selectedTagId));
      markDirty();
    }
  }
  const [clientIssue, setClientIssue] = useState("");
  const [linkIssue, setLinkIssue] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [linkEntryOpen, setLinkEntryOpen] = useState(false);
  const [slugState, setSlugState] = useState<InsightsActionState>(initialActionState);
  const [slugPending, setSlugPending] = useState(false);
  const [submitState, setSubmitState] = useState<InsightsActionState>(initialActionState);
  const [publishState, setPublishState] = useState<InsightsActionState>(initialActionState);
  const [coverMedia, setCoverMedia] = useState<InsightsMedia | null>(article?.coverMedia ?? null);
  const [coverAlt, setCoverAlt] = useState(article?.coverMedia?.altText ?? "");
  const [inlineMedia, setInlineMedia] = useState<InsightsMedia[]>(article?.inlineMedia ?? []);
  const [mediaAlt, setMediaAlt] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<"cover" | "inline">("cover");
  const [mediaState, setMediaState] = useState<InsightsMediaActionState>(initialMediaState);
  const [mediaAction, setMediaAction] = useState<MediaAction | null>(null);
  const [mediaPending, startMediaTransition] = useTransition();
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const mediaInFlightRef = useRef(false);
  const [workflowPending, setWorkflowPending] = useState(false);
  const [leaveHref, setLeaveHref] = useState("");
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const persistedArticleIdRef = useRef(article?.id ?? "");
  const expectedUpdatedAtRef = useRef(article?.updatedAt ?? "");
  const changeVersionRef = useRef(0);
  const latestSnapshotRef = useRef<Snapshot | null>(null);
  const inFlightRef = useRef<Promise<InsightsActionState> | null>(null);
  const queuedSaveRef = useRef<{ kind: SaveKind; snapshot: Snapshot; resolve: (result: InsightsActionState) => void } | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutosaveCompletedRef = useRef(0);
  const autosaveStoppedRef = useRef(false);

  function markDirty() {
    changeVersionRef.current += 1;
    autosaveStoppedRef.current = false;
    setDirty(true);
    setSaveStatus("dirty");
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, horizontalRule: false, strike: false, underline: false, link: false }),
      InsightsImage,
      LinkExtension.configure({ openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: "_blank", rel: "noreferrer noopener" } }),
      Placeholder.configure({ placeholder: "Write the Draft here…" }),
    ],
    content: initial.doc,
    editorProps: { attributes: { "aria-label": "Article body", "aria-describedby": "article-body-help" } },
    onUpdate: ({ editor: currentEditor }) => {
      setBodyJson(JSON.stringify(stripResolvedInsightsMedia({ schema: "insights-body", version: 2, doc: currentEditor.getJSON() })));
      markDirty();
    },
  });

  latestSnapshotRef.current = { articleId: persistedArticleIdRef.current, expectedUpdatedAt: expectedUpdatedAtRef.current, title, excerpt, categoryId, tagIds: [...tagIds], bodyJson, version: changeVersionRef.current };

  function makeFormData(snapshot: Snapshot) {
    const data = new FormData();
    data.set("article_id", snapshot.articleId);
    data.set("expected_updated_at", snapshot.expectedUpdatedAt);
    data.set("title", snapshot.title);
    data.set("excerpt", snapshot.excerpt);
    data.set("category_id", snapshot.categoryId);
    data.set("body", snapshot.bodyJson);
    snapshot.tagIds.forEach((tagId) => data.append("tag_ids", tagId));
    if (coverMedia?.id) data.set("cover_media_id", coverMedia.id);
    return data;
  }

  async function runSave(kind: SaveKind, snapshot: Snapshot): Promise<InsightsActionState> {
    setSaveStatus("saving");
    setSaveState({ ...initialActionState, status: "idle" });
    const result = await saveInsightsDraft(initialActionState, makeFormData(snapshot));
    if (kind === "autosave") lastAutosaveCompletedRef.current = Date.now();
    if (result.status === "saved") {
      if (result.articleId) persistedArticleIdRef.current = result.articleId;
      if (result.updatedAt) expectedUpdatedAtRef.current = result.updatedAt;
      setLastSavedAt(result.savedAt ?? new Date().toISOString());
      setSaveState(result);
      if (changeVersionRef.current === snapshot.version) {
        setDirty(false);
        setSaveStatus("saved");
      } else {
        setDirty(true);
        setSaveStatus("dirty");
      }
      if (!article && result.articleId) router.replace(`/crimson-admin-control/insights/articles/${result.articleId}`);
    } else {
      setSaveState(result);
      setDirty(true);
      setSaveStatus(result.status === "conflict" ? "conflict" : "error");
      if (result.status === "conflict") autosaveStoppedRef.current = true;
    }
    return result;
  }

  function requestSave(kind: SaveKind, suppliedSnapshot?: Snapshot): Promise<InsightsActionState> {
    const snapshot = suppliedSnapshot ?? latestSnapshotRef.current;
    if (!snapshot) return Promise.resolve({ ...initialActionState, status: "error", message: "The Draft snapshot is unavailable.", issues: [] });
    if (kind === "explicit" && autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (inFlightRef.current) return new Promise((resolve) => { queuedSaveRef.current = { kind, snapshot, resolve }; });
    if (kind === "autosave") {
      const wait = AUTOSAVE_MIN_INTERVAL_MS - (Date.now() - lastAutosaveCompletedRef.current);
      if (wait > 0) return new Promise((resolve) => { autosaveTimerRef.current = setTimeout(() => { autosaveTimerRef.current = null; requestSave(kind, snapshot).then(resolve); }, wait); });
    }
    const promise = runSave(kind, snapshot);
    inFlightRef.current = promise;
    promise.then((result) => {
      inFlightRef.current = null;
      const queued = queuedSaveRef.current;
      queuedSaveRef.current = null;
      if (!queued) return;
      if (result.status === "conflict") queued.resolve(result);
      else requestSave(queued.kind, queued.snapshot).then(queued.resolve);
    }).catch(() => { inFlightRef.current = null; });
    return promise;
  }

  async function flushPendingSave() {
    if (inFlightRef.current) return inFlightRef.current;
    if (dirty) return requestSave("explicit");
    return { ...initialActionState, status: "saved" as const, message: "Draft is already saved." };
  }

  useEffect(() => {
    if (!article || !dirty || autosaveStoppedRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => { autosaveTimerRef.current = null; requestSave("autosave"); }, AUTOSAVE_DEBOUNCE_MS);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
    // The latest snapshot is intentionally read from a ref by the coordinator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, dirty, title, excerpt, categoryId, tagIds, bodyJson]);

  useEffect(() => {
    if (!dirty && !inFlightRef.current && saveStatus !== "error" && saveStatus !== "conflict") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saveStatus]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!(dirty || inFlightRef.current || saveStatus === "error" || saveStatus === "conflict")) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const anchor = target?.closest("a");
      if (!anchor || anchor.dataset.leaveConfirmed !== undefined || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (anchor.origin !== window.location.origin || anchor.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveHref(anchor.href);
    };
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [dirty, saveStatus]);

  function toggleTag(tagId: string) {
    setTagIds((current) => current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId]);
    markDirty();
  }

  function beginLink() {
    if (!editor) return;
    linkSelectionRef.current = { from: editor.state.selection.from, to: editor.state.selection.to };
    setLinkIssue("");
    setLinkEntryOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const href = linkHref.trim();
    if (!/^https?:\/\/[^\s]+$/i.test(href)) { setLinkIssue("Use a full http(s) link."); return; }
    const selection = linkSelectionRef.current;
    const chain = editor.chain().focus();
    if (selection) chain.setTextSelection(selection);
    chain.extendMarkRange("link").setLink({ href }).run();
    linkSelectionRef.current = null;
    setLinkHref("");
    setLinkEntryOpen(false);
    setLinkIssue("");
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveStatus === "saving" || inFlightRef.current) return;
    if (!title.trim()) { setClientIssue("Enter a Title before saving this Draft."); titleRef.current?.focus(); return; }
    setClientIssue("");
    requestSave("explicit");
  }

  async function handleSubmitForReview() {
    if (!persistedArticleIdRef.current) return;
    const saved = await flushPendingSave();
    if (saved.status !== "saved") return;
    setWorkflowPending(true);
    const data = new FormData();
    data.set("article_id", persistedArticleIdRef.current);
    data.set("expected_updated_at", expectedUpdatedAtRef.current);
    const result = await submitInsightsForReview(initialActionState, data);
    setSubmitState(result);
    setWorkflowPending(false);
    if (result.status === "saved") router.refresh();
  }

  async function handleSlugSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await flushPendingSave();
    if (saved.status !== "saved") return;
    if (!isValidInsightsSlug(slug)) { setSlugState({ ...initialActionState, status: "error", message: "Enter a valid lowercase kebab-case slug." }); return; }
    setSlugPending(true);
    const data = new FormData();
    data.set("article_id", persistedArticleIdRef.current);
    data.set("expected_updated_at", expectedUpdatedAtRef.current);
    data.set("slug", slug);
    const result = await updateInsightsSlug(initialActionState, data);
    setSlugState(result);
    setSlugPending(false);
    if (result.status === "saved" && result.slug) setSlug(result.slug);
    if (result.status === "saved" && result.updatedAt) expectedUpdatedAtRef.current = result.updatedAt;
  }

  function mediaFormData(kind: "cover" | "inline", mediaId?: string) {
    const data = new FormData();
    data.set("article_id", persistedArticleIdRef.current);
    data.set("expected_updated_at", expectedUpdatedAtRef.current);
    data.set("media_kind", kind);
    data.set("media_alt", kind === "cover" ? coverAlt.trim() : mediaAlt.trim());
    data.set("media_caption", mediaCaption.trim());
    if (mediaFile) data.set("media_file", mediaFile);
    if (mediaId) data.set("media_id", mediaId);
    return data;
  }

  function runMediaAction(action: MediaAction, task: () => Promise<void>) {
    if (mediaPending || mediaInFlightRef.current) return;
    mediaInFlightRef.current = true;
    setMediaAction(action);
    startMediaTransition(async () => {
      try {
        await task();
      } finally {
        mediaInFlightRef.current = false;
        setMediaAction(null);
      }
    });
  }

  function handleMediaUpload(kind: "cover" | "inline" = mediaKind) {
    if (!mediaFile || !persistedArticleIdRef.current) {
      setMediaState({ ...initialMediaState, status: "error", message: "Save the Draft and choose an image before uploading." });
      return;
    }
    const alt = kind === "cover" ? coverAlt.trim() : mediaAlt.trim();
    const caption = mediaCaption.trim();
    runMediaAction("upload", async () => {
      const result = await uploadInsightsMedia(initialMediaState, mediaFormData(kind));
      setMediaState(result);
      if (result.status !== "saved" || !result.mediaId) return;
      if (result.updatedAt) expectedUpdatedAtRef.current = result.updatedAt;
      if (kind === "cover") {
        setCoverMedia({ id: result.mediaId, kind: "cover", altText: alt, caption: caption || null, width: 0, height: 0, previewUrl: result.previewUrl ?? null });
        setCoverAlt(alt);
      } else if (editor) {
        editor.chain().focus().insertContent({ type: "image", attrs: { mediaId: result.mediaId, alt, caption: caption || null, src: result.previewUrl ?? null } }).run();
        setInlineMedia((current) => [...current, { id: result.mediaId!, kind: "inline", altText: alt, caption: caption || null, width: 0, height: 0, previewUrl: result.previewUrl ?? null }]);
      }
      setMediaFile(null);
      if (mediaFileRef.current) mediaFileRef.current.value = "";
      setMediaAlt("");
      setMediaCaption("");
      router.refresh();
    });
  }

  function updateCoverAlt() {
    if (!coverMedia?.id || coverAlt.trim().length < 8) {
      setMediaState({ ...initialMediaState, status: "error", message: "Enter meaningful Cover alternative text." });
      return;
    }
    const data = new FormData();
    data.set("article_id", persistedArticleIdRef.current);
    data.set("expected_updated_at", expectedUpdatedAtRef.current);
    data.set("media_id", coverMedia.id);
    data.set("media_alt", coverAlt.trim());
    runMediaAction("save-alt", async () => {
      const result = await updateInsightsMediaAlt(initialMediaState, data);
      setMediaState(result);
      if (result.status !== "saved") return;
      if (result.updatedAt) expectedUpdatedAtRef.current = result.updatedAt;
      setCoverAlt(coverAlt.trim());
      router.refresh();
    });
  }

  function removeMedia(mediaId: string, kind: "cover" | "inline") {
    if (!persistedArticleIdRef.current) return;
    const data = new FormData();
    data.set("article_id", persistedArticleIdRef.current);
    data.set("expected_updated_at", expectedUpdatedAtRef.current);
    data.set("media_id", mediaId);
    runMediaAction("remove", async () => {
      const result = await removeInsightsMedia(initialMediaState, data);
      setMediaState(result);
      if (result.status !== "saved") return;
      if (result.updatedAt) expectedUpdatedAtRef.current = result.updatedAt;
      if (kind === "cover") setCoverMedia(null);
      else {
        setInlineMedia((current) => current.filter((item) => item.id !== mediaId));
        let position: number | null = null;
        editor?.state.doc.descendants((node, nodePosition) => {
          if (position === null && node.type.name === "image" && node.attrs.mediaId === mediaId) position = nodePosition;
        });
        if (editor && position !== null) {
          const target = editor.state.doc.nodeAt(position);
          if (target) editor.commands.deleteRange({ from: position, to: position + target.nodeSize });
        }
      }
      router.refresh();
    });
  }

  function updateSelectedInlineAlt() {
    const selected = editor && "node" in editor.state.selection ? editor.state.selection.node as { type: { name: string }; attrs: Record<string, unknown> } : null;
    const mediaId = selected?.type.name === "image" && typeof selected.attrs.mediaId === "string" ? selected.attrs.mediaId : null;
    if (!mediaId || !mediaAlt.trim()) {
      setMediaState({ ...initialMediaState, status: "error", message: "Select an inline image and enter meaningful alternative text." });
      return;
    }
    const data = new FormData();
    data.set("article_id", persistedArticleIdRef.current);
    data.set("expected_updated_at", expectedUpdatedAtRef.current);
    data.set("media_id", mediaId);
    data.set("media_alt", mediaAlt.trim());
    runMediaAction("save-alt", async () => {
      const result = await updateInsightsMediaAlt(initialMediaState, data);
      setMediaState(result);
      if (result.status !== "saved") return;
      editor?.commands.updateAttributes("image", { alt: mediaAlt.trim() });
      if (result.updatedAt) expectedUpdatedAtRef.current = result.updatedAt;
      setMediaAlt("");
      router.refresh();
    });
  }

  const saveFeedback = saveState.status === "error" || saveState.status === "conflict" ? saveState : null;
  const slugFeedback = slugState.status === "error" || slugState.status === "conflict" ? slugState : null;
  const canSubmit = Boolean(article) && (role === "owner" || role === "editor");
  const canPublishDraft = Boolean(article) && role === "editor" && canPublishInsights;

  async function handlePublishOwnDraft() {
    const saved = await flushPendingSave();
    if (saved.status !== "saved") return;
    setWorkflowPending(true);
    const data = new FormData();
    data.set("article_id", persistedArticleIdRef.current);
    data.set("expected_updated_at", expectedUpdatedAtRef.current);
    const result = await publishInsightsArticle(initialActionState, data);
    setPublishState(result);
    setWorkflowPending(false);
    if (result.status === "saved") router.refresh();
  }

  return (
    <div className="insights-composer-layout">
      <form className="insights-composer" onSubmit={handleSave}>
        <input type="hidden" name="article_id" value={persistedArticleIdRef.current} /><input type="hidden" name="expected_updated_at" value={expectedUpdatedAtRef.current} /><input type="hidden" name="body" value={bodyJson} readOnly /><input type="hidden" name="cover_media_id" value={coverMedia?.id ?? ""} />
        <div className="insights-writing-fields">
          <label className="insights-field insights-title-field"><span>Title</span><input ref={titleRef} className="insights-title-input" name="title" value={title} onChange={(event) => { setTitle(event.target.value); markDirty(); }} maxLength={160} placeholder="Give this article a clear working title" aria-invalid={Boolean(clientIssue)} aria-describedby={clientIssue ? "title-error" : undefined} /></label>
          {clientIssue ? <p className="insights-field-error" id="title-error" role="alert">{clientIssue}</p> : null}
          <div className="insights-editor-block"><div className="insights-field-heading"><span className="insights-field-label">Body</span><span id="article-body-help">Write the article and add approved private media. Public URLs are never saved in the Draft body.</span></div><div className="insights-toolbar" aria-label="Text formatting"><ToolbarButton label="H2" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} disabled={!editor} /><ToolbarButton label="H3" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} disabled={!editor} /><ToolbarButton label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} disabled={!editor} /><ToolbarButton label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={!editor} /><ToolbarButton label="Link" onClick={beginLink} onMouseDown={(event) => event.preventDefault()} disabled={!editor} /><ToolbarButton label="Bulleted list" onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={!editor} /><ToolbarButton label="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={!editor} /><ToolbarButton label="Blockquote" onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={!editor} /><span className="insights-toolbar-spacer" /><ToolbarButton label="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor} /><ToolbarButton label="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor} /></div>{linkEntryOpen ? <div className="insights-link-entry"><label><span>Link URL</span><input aria-label="Link URL" value={linkHref} onChange={(event) => setLinkHref(event.target.value)} placeholder="https://example.com" inputMode="url" autoFocus /></label><button type="button" className="button button-light" onClick={applyLink}>Apply link</button><button type="button" className="button button-light" onClick={() => { setLinkHref(""); setLinkEntryOpen(false); setLinkIssue(""); }}>Cancel</button></div> : null}<div id="article-body-editor" className="insights-editor-surface"><EditorContent editor={editor} /></div>{linkIssue ? <p className="insights-field-error" role="alert">{linkIssue}</p> : null}</div>
          <section className="insights-media-authoring" aria-labelledby="insights-media-heading"><div className="insights-field-heading"><span className="insights-field-label" id="insights-media-heading">Media</span><span>JPEG, PNG, WebP, or AVIF · source and normalized output up to 2 MB. Existing media metadata can be updated without replacing the asset.</span></div><div className="insights-media-grid"><div className="insights-media-card"><strong>Cover image</strong>{coverMedia?.previewUrl ? <img className="insights-cover-preview" src={coverMedia.previewUrl} alt={coverMedia.altText} /> : <div className="insights-media-empty">No Cover selected</div>}<label className="insights-field"><span>Cover file</span><input ref={mediaKind === "cover" ? mediaFileRef : undefined} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { setMediaKind("cover"); setMediaFile(event.target.files?.[0] ?? null); }} /></label><label className="insights-field"><span>Alternative text</span><input value={coverAlt} onChange={(event) => setCoverAlt(event.target.value)} placeholder="Describe the Cover image" maxLength={300} /></label><div className="insights-media-actions"><button className="button button-light" type="button" onClick={updateCoverAlt} disabled={mediaPending || !coverMedia}>{mediaPending && mediaAction === "save-alt" ? <><span className="admin-button-spinner" aria-hidden="true" />Saving…</> : "Update Cover alt"}</button><button className="button button-light" type="button" onClick={() => { setMediaKind("cover"); handleMediaUpload(); }} disabled={mediaPending}>{mediaPending && mediaAction === "upload" ? <><span className="admin-button-spinner" aria-hidden="true" />Uploading…</> : coverMedia ? "Replace Cover" : "Add Cover"}</button>{coverMedia ? <button className="button button-light" type="button" onClick={() => removeMedia(coverMedia.id, "cover")} disabled={mediaPending}>{mediaPending && mediaAction === "remove" ? <><span className="admin-button-spinner" aria-hidden="true" />Removing…</> : "Remove Cover"}</button> : null}</div></div><div className="insights-media-card"><strong>Inline image</strong><p className="insights-muted">Upload, then insert the image at the current cursor position.</p><label className="insights-field"><span>Inline file</span><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { setMediaKind("inline"); setMediaFile(event.target.files?.[0] ?? null); }} /></label><label className="insights-field"><span>Alternative text</span><input value={mediaKind === "inline" ? mediaAlt : ""} onChange={(event) => { setMediaKind("inline"); setMediaAlt(event.target.value); }} placeholder="Describe the inline image" maxLength={300} /></label><label className="insights-field"><span>Caption <small>Optional · max 300 characters</small></span><input value={mediaKind === "inline" ? mediaCaption : ""} onChange={(event) => { setMediaKind("inline"); setMediaCaption(event.target.value); }} maxLength={300} /></label><button className="button button-light" type="button" onClick={() => { setMediaKind("inline"); handleMediaUpload(); }} disabled={mediaPending}>{mediaPending && mediaAction === "upload" ? <><span className="admin-button-spinner" aria-hidden="true" />Uploading…</> : "Insert inline image"}</button></div></div>{inlineMedia.length ? <div className="insights-inline-media-list"><strong>Inline media in this Draft</strong>{inlineMedia.map((media) => <div className="insights-inline-media-item" key={media.id}><span>{media.altText}</span><button className="button button-light" type="button" onClick={() => removeMedia(media.id, "inline")} disabled={mediaPending}>{mediaPending && mediaAction === "remove" ? <><span className="admin-button-spinner" aria-hidden="true" />Removing…</> : "Remove"}</button></div>)}</div> : null}<div className="insights-media-edit-row"><label className="insights-field"><span>Selected inline image alternative text</span><input value={mediaAlt} onChange={(event) => setMediaAlt(event.target.value)} placeholder="Select an inline image in the editor" maxLength={300} /></label><button className="button button-light" type="button" onClick={updateSelectedInlineAlt} disabled={mediaPending}>{mediaPending && mediaAction === "save-alt" ? <><span className="admin-button-spinner" aria-hidden="true" />Saving…</> : "Update selected alt"}</button></div>{mediaState.status !== "idle" ? <p className={mediaState.status === "saved" ? "insights-success" : "insights-error"} role={mediaState.status === "saved" ? "status" : "alert"}>{mediaState.message}</p> : null}</section>
          <label className="insights-field"><span>Excerpt <small>Optional · max 300 characters</small></span><textarea name="excerpt" value={excerpt} onChange={(event) => { setExcerpt(event.target.value); markDirty(); }} maxLength={300} placeholder="A short introduction for article lists" /></label>
        </div>
        <aside className="insights-metadata-panel" aria-label="Article metadata">
          <div className="insights-panel-heading"><div><p className="admin-kicker admin-kicker-green">Draft metadata</p><h2>Make it findable.</h2></div><span>Optional until review</span></div>
          <label className="insights-field"><span>Primary Category</span><select name="category_id" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setCategoryFeedback(initialCategoryState); markDirty(); }}><option value="">No category yet</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          {role === "owner" ? <div className="insights-category-create">
            <label className="insights-field"><span>Create Category</span><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={80} placeholder="e.g. Practice" /></label>
            <div className="insights-category-actions" aria-label="Category actions">
              <InsightsTaxonomyActionButton className="button insights-category-create-button" onAction={handleCreateCategory} pendingLabel="Creating…" idleContent={<><span className="insights-category-action-icon" aria-hidden="true">＋</span>Create</>} />
              <InsightsTaxonomyActionButton className="button insights-category-delete-button" onAction={handleDeleteCategory} pendingLabel="Deleting…" disabled={!categoryId} idleContent={<><svg className="insights-category-action-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 5.5v7.25c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V5.5M6 5.5V4.25C6 3.56 6.56 3 7.25 3h1.5C9.44 3 10 3.56 10 4.25V5.5M2.5 5.5h11M6.5 7.5v4M9.5 7.5v4" /></svg>Delete</>} />
            </div>
            {categoryFeedback.status !== "idle" ? <p className={categoryFeedback.status === "saved" ? "insights-success insights-category-feedback" : "insights-error insights-category-feedback"} role={categoryFeedback.status === "saved" ? "status" : "alert"}>{categoryFeedback.status === "saved" ? "✓ " : ""}{categoryFeedback.message}</p> : null}
          </div> : null}
          <fieldset className="insights-tags-field"><legend>Tags <small>Optional</small></legend>
            {role === "owner" ? <div className="insights-tag-management">
              <label className="insights-field"><span>Create Tag</span><input value={tagName} onChange={(event) => setTagName(event.target.value)} maxLength={80} placeholder="e.g. Strategy" /></label>
              <div className="insights-category-actions" aria-label="Tag actions">
                <InsightsTaxonomyActionButton className="button insights-category-create-button" onAction={handleCreateTag} pendingLabel="Creating…" idleContent={<><span className="insights-category-action-icon" aria-hidden="true">＋</span>Create</>} />
                <InsightsTaxonomyActionButton className="button insights-category-delete-button" onAction={handleDeleteTag} pendingLabel="Deleting…" disabled={!tagIds.length} idleContent={<><svg className="insights-category-action-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 5.5v7.25c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V5.5M6 5.5V4.25C6 3.56 6.56 3 7.25 3h1.5C9.44 3 10 3.56 10 4.25V5.5M2.5 5.5h11M6.5 7.5v4M9.5 7.5v4" /></svg>Delete selected</>} />
              </div>
              {tagFeedback.status !== "idle" ? <p className={tagFeedback.status === "saved" ? "insights-success insights-category-feedback" : "insights-error insights-category-feedback"} role={tagFeedback.status === "saved" ? "status" : "alert"}>{tagFeedback.status === "saved" ? "✓ " : ""}{tagFeedback.message}</p> : null}
            </div> : null}
            {tags.length ? <div className="insights-tag-grid">{tags.map((tag) => <label className="insights-check" key={tag.id}><input type="checkbox" name="tag_ids" value={tag.id} checked={tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} /><span>{tag.name}</span></label>)}</div> : <p className="insights-muted">{role === "owner" ? "Create a Tag to make this Draft easier to find." : "No approved Tags are available yet."}</p>}
          </fieldset>
          {saveFeedback ? <div className="insights-error" role="alert"><strong>{actionMessage(saveFeedback)}</strong>{saveFeedback.issues.length ? <ul>{saveFeedback.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}<button className="button button-light insights-retry-button" type="button" onClick={() => requestSave("explicit")} disabled={saveStatus === "saving"}>Retry</button></div> : null}<div className="insights-save-row"><div className="insights-save-copy" aria-live="polite"><strong>{saveStatus === "saving" ? "Saving…" : saveStatus === "dirty" ? "Unsaved changes" : saveStatus === "conflict" ? "Conflict — reload required" : saveStatus === "error" ? "Save failed" : hasMounted ? formatSavedAt(lastSavedAt) : article ? "Saved" : "Not saved yet"}</strong><span>{saveStatus === "conflict" ? "Your local changes were not overwritten." : saveStatus === "error" ? "Your local changes are still here." : "Autosaves after a short pause; explicit Save Draft remains available."}</span></div><button className="button button-primary insights-save-button" type="submit" disabled={saveStatus === "saving"}>{saveStatus === "saving" ? <><span className="admin-button-spinner" aria-hidden="true" />Saving…</> : "Save Draft"}</button></div>{saveStatus === "conflict" ? <button className="button button-light insights-reload-button" type="button" onClick={() => router.refresh()}>Reload latest saved version</button> : null}
        </aside>
      </form>
      {article ? <div className="insights-composer-actions"><Link className="button button-light" href={`/crimson-admin-control/insights/articles/${article.id}/preview`}>Preview ↗</Link>{canSubmit ? <button className="button button-light" type="button" onClick={handleSubmitForReview} disabled={workflowPending || saveStatus === "saving"}>{workflowPending ? "Submitting…" : "Submit for Review"}</button> : null}{canPublishDraft ? <button className="button button-primary" type="button" onClick={handlePublishOwnDraft} disabled={workflowPending || saveStatus === "saving"}>{workflowPending ? "Publishing…" : "Publish own Draft"}</button> : null}{submitState.status !== "idle" ? <p className={submitState.status === "saved" ? "insights-success" : "insights-error"} role={submitState.status === "saved" ? "status" : "alert"}>{actionMessage(submitState)}</p> : null}{publishState.status !== "idle" ? <p className={publishState.status === "saved" ? "insights-success" : "insights-error"} role={publishState.status === "saved" ? "status" : "alert"}>{actionMessage(publishState)}</p> : null}</div> : null}
      {article ? <details className="insights-advanced"><summary>Advanced: slug</summary><div className="insights-advanced-body"><p>Keep this stable once the article is published. The server remains authoritative for ownership, Draft status, concurrency, and uniqueness.</p><form onSubmit={handleSlugSubmit} className="insights-slug-form"><input type="hidden" name="article_id" value={article.id} /><label className="insights-field"><span>Slug</span><input name="slug" value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={120} aria-describedby="slug-help" /></label><span id="slug-help" className="insights-muted">Lowercase letters, numbers, and hyphens.</span><button className="button button-light insights-slug-button" type="submit" disabled={slugPending || !isValidInsightsSlug(slug) || slugState.status === "saved" && slug === article.slug}>{slugPending ? <><span className="admin-button-spinner" aria-hidden="true" />Updating…</> : "Update slug"}</button></form>{slugFeedback ? <div className="insights-error" role="alert">{actionMessage(slugFeedback)}</div> : null}{slugState.status === "saved" ? <div className="insights-success" role="status">Slug updated.</div> : null}</div></details> : null}
      {leaveHref ? <div className="insights-leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-dialog-title"><h2 id="leave-dialog-title">Unsaved changes</h2><p>Your local changes have not been confirmed by the server.</p><div><button className="button button-light" type="button" onClick={() => setLeaveHref("")}>Stay</button><a className="button button-primary" data-leave-confirmed href={leaveHref}>Leave without saving</a></div></div> : null}
    </div>
  );
}
