export const INSIGHTS_BODY_SCHEMA = "insights-body" as const;
export const INSIGHTS_BODY_VERSION = 1 as const;
export const MAX_INSIGHTS_BODY_BYTES = 256_000;
export const MAX_INSIGHTS_BODY_NODES = 500;
export const MAX_INSIGHTS_BODY_DEPTH = 12;
export const MAX_INSIGHTS_BODY_TEXT = 50_000;

export type InsightsMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string; target?: "_blank" | null } };

export type InsightsNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: InsightsNode[];
  text?: string;
  marks?: InsightsMark[];
};

export type InsightsBody = {
  schema: typeof INSIGHTS_BODY_SCHEMA;
  version: typeof INSIGHTS_BODY_VERSION;
  doc: InsightsNode;
};

export type InsightsBodyValidation =
  | { success: true; value: InsightsBody }
  | { success: false; issues: string[] };

const allowedNodeTypes = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
]);

const allowedMarkTypes = new Set(["bold", "italic", "link"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeLink(value: string): boolean {
  if (/[\u0000-\u001f\u007f\s]/.test(value) || value.startsWith("//")) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validateAttrs(node: InsightsNode, issues: string[], path: string) {
  const attrs = node.attrs;
  if (node.type === "heading") {
    if (!isRecord(attrs) || Object.keys(attrs).some((key) => key !== "level") || ![2, 3].includes(attrs.level as number)) {
      issues.push(`${path} heading level must be 2 or 3.`);
    }
    return;
  }
  if (node.type === "orderedList") {
    if (attrs !== undefined && (!isRecord(attrs) || Object.keys(attrs).some((key) => key !== "start") || (attrs.start !== undefined && (!Number.isInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 100)))) {
      issues.push(`${path} ordered list attributes are invalid.`);
    }
    return;
  }
  if (node.type === "link") return;
  if (attrs !== undefined && (!isRecord(attrs) || Object.keys(attrs).length > 0)) {
    issues.push(`${path} contains unsupported attributes.`);
  }
}

function validateMarks(node: InsightsNode, issues: string[], path: string) {
  if (node.marks === undefined) return;
  if (!Array.isArray(node.marks)) {
    issues.push(`${path} marks must be an array.`);
    return;
  }
  for (const [index, markValue] of node.marks.entries()) {
    const markPath = `${path}.marks[${index}]`;
    if (!isRecord(markValue) || typeof markValue.type !== "string" || !allowedMarkTypes.has(markValue.type)) {
      issues.push(`${markPath} is not allowed.`);
      continue;
    }
    const mark = markValue as InsightsMark & { attrs?: Record<string, unknown> };
    if (mark.type === "link") {
      const attrs = mark.attrs;
      if (!isRecord(attrs) || Object.keys(attrs).some((key) => !["href", "target", "class"].includes(key)) || typeof attrs.href !== "string" || !isSafeLink(attrs.href) || (attrs.target !== undefined && attrs.target !== null && attrs.target !== "_blank")) {
        issues.push(`${markPath} link must use an http(s) URL.`);
      }
    } else if (mark.attrs !== undefined && (!isRecord(mark.attrs) || Object.keys(mark.attrs).length > 0)) {
      issues.push(`${markPath} contains unsupported attributes.`);
    }
  }
}

function validateNode(value: unknown, issues: string[], path: string, depth: number, state: { nodes: number; text: number }) {
  if (!isRecord(value) || typeof value.type !== "string" || !allowedNodeTypes.has(value.type)) {
    issues.push(`${path} is not an allowed node.`);
    return;
  }
  const node = value as InsightsNode;
  state.nodes += 1;
  if (state.nodes > MAX_INSIGHTS_BODY_NODES) {
    issues.push("The article body contains too many nodes.");
    return;
  }
  if (depth > MAX_INSIGHTS_BODY_DEPTH) {
    issues.push("The article body is nested too deeply.");
    return;
  }
  validateAttrs(node, issues, path);
  validateMarks(node, issues, path);

  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text.length === 0) issues.push(`${path} text is missing.`);
    else {
      state.text += node.text.length;
      if (state.text > MAX_INSIGHTS_BODY_TEXT) issues.push("The article body contains too much text.");
    }
    if (node.content !== undefined) issues.push(`${path} text cannot contain content.`);
    return;
  }
  if (node.type === "hardBreak") {
    if (node.content !== undefined || node.text !== undefined || node.marks !== undefined) issues.push(`${path} hard breaks cannot contain attributes or text.`);
    return;
  }
  if (node.type === "heading" && (!node.content || node.content.some((child) => !isRecord(child) || child.type !== "text"))) {
    issues.push(`${path} headings may contain text only.`);
  }
  if (node.content !== undefined && !Array.isArray(node.content)) {
    issues.push(`${path} content must be an array.`);
    return;
  }
  if (node.type !== "doc" && node.type !== "paragraph" && node.type !== "heading" && node.type !== "bulletList" && node.type !== "orderedList" && node.type !== "listItem" && node.type !== "blockquote" && node.content === undefined) {
    issues.push(`${path} content is required.`);
  }
  for (const [index, child] of (node.content ?? []).entries()) validateNode(child, issues, `${path}.content[${index}]`, depth + 1, state);
}

export function emptyInsightsBody(): InsightsBody {
  return {
    schema: INSIGHTS_BODY_SCHEMA,
    version: INSIGHTS_BODY_VERSION,
    doc: { type: "doc", content: [{ type: "paragraph" }] },
  };
}

export function validateInsightsBody(value: unknown): InsightsBodyValidation {
  const issues: string[] = [];
  if (!isRecord(value) || value.schema !== INSIGHTS_BODY_SCHEMA || value.version !== INSIGHTS_BODY_VERSION || !isRecord(value.doc)) {
    return { success: false, issues: ["The article body must use the Insights body schema v1 envelope."] };
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_INSIGHTS_BODY_BYTES) return { success: false, issues: ["The article body is too large."] };
  validateNode(value.doc, issues, "doc", 0, { nodes: 0, text: 0 });
  return issues.length > 0 ? { success: false, issues: [...new Set(issues)] } : { success: true, value: value as InsightsBody };
}

export function parseInsightsBody(value: string): InsightsBodyValidation {
  try {
    return validateInsightsBody(JSON.parse(value));
  } catch {
    return { success: false, issues: ["The article body could not be read."] };
  }
}

export function isSafeInsightsLink(value: string): boolean {
  return isSafeLink(value);
}
