import Link from "next/link";

export function PageDocumentPreviewBanner({ pageLabel, status, revisionId, returnHref }: { pageLabel: string; status: "draft" | "review"; revisionId: string; returnHref: string }) {
  return <aside className="admin-role-alert" aria-label="PageDocument preview notice"><strong>Preview — unpublished content</strong><span>{pageLabel} · {status === "draft" ? "Draft" : "Review"} · revision {revisionId}</span><span>This private preview does not change the public site. <Link href={returnHref}>Return to CMS</Link></span></aside>;
}
