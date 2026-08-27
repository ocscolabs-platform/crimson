/* eslint-disable @next/next/no-img-element -- private/public media URLs are runtime-resolved. */
import type { ReactNode } from "react";
import { isSafeInsightsLink, type InsightsBody, type InsightsMark, type InsightsNode, validateInsightsBody } from "@/lib/insights-body";

function renderInline(node: InsightsNode, key: string): ReactNode {
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type !== "text" || typeof node.text !== "string") return null;

  let content: ReactNode = node.text;
  for (const [index, mark] of (node.marks ?? []).entries()) {
    const markKey = `${key}-mark-${index}`;
    if (mark.type === "bold") content = <strong key={markKey}>{content}</strong>;
    if (mark.type === "italic") content = <em key={markKey}>{content}</em>;
    if (mark.type === "link" && isSafeInsightsLink(mark.attrs.href)) {
      content = <a key={markKey} href={mark.attrs.href} target="_blank" rel="noreferrer noopener">{content}</a>;
    }
  }
  return <span key={key}>{content}</span>;
}

function renderNode(node: InsightsNode, key: string): ReactNode {
  if (node.type === "text" || node.type === "hardBreak") return renderInline(node, key);
  if (node.type === "image") {
    const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
    const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
    const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption : "";
    if (!src) return <p key={key} className="insights-media-unavailable">Image unavailable in this preview.</p>;
    return <figure className="insights-rendered-image" key={key}><img src={src} alt={alt} />{caption ? <figcaption>{caption}</figcaption> : null}</figure>;
  }
  const children = (node.content ?? []).map((child, index) => renderNode(child, `${key}-${index}`));
  if (node.type === "doc") return <>{children}</>;
  if (node.type === "paragraph") return <p key={key}>{children}</p>;
  if (node.type === "heading") return node.attrs?.level === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>;
  if (node.type === "bulletList") return <ul key={key}>{children}</ul>;
  if (node.type === "orderedList") {
    const start = typeof node.attrs?.start === "number" && node.attrs.start > 1 ? node.attrs.start : undefined;
    return <ol key={key} start={start}>{children}</ol>;
  }
  if (node.type === "listItem") return <li key={key}>{children}</li>;
  if (node.type === "blockquote") return <blockquote key={key}>{children}</blockquote>;
  return null;
}

export function renderInsightsBody(body: InsightsBody): ReactNode {
  const validation = validateInsightsBody(body);
  if (!validation.success) return <p>Article content is unavailable.</p>;
  return renderNode(validation.value.doc, "insights-body");
}

export function getInsightsPlainText(body: InsightsBody): string {
  const parts: string[] = [];
  function walk(node: InsightsNode) {
    if (node.type === "text" && node.text) parts.push(node.text);
    for (const child of node.content ?? []) walk(child);
    if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type)) parts.push(" ");
  }
  walk(body.doc);
  return parts.join("").replace(/\s+/g, " ").trim();
}

export function hasOnlyApprovedMarks(marks: InsightsMark[] | undefined): boolean {
  return (marks ?? []).every((mark) => ["bold", "italic", "link"].includes(mark.type));
}
