import Link from "next/link";

type AdminBreadcrumbsProps = {
  section: "Services" | "Work library" | "Team & access";
  record: string;
};

export default function AdminBreadcrumbs({ section, record }: AdminBreadcrumbsProps) {
  return (
    <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
      <Link href="/admin">Dashboard</Link>
      <span aria-hidden="true">/</span>
      <span>{section}</span>
      <span aria-hidden="true">/</span>
      <strong aria-current="page">{record}</strong>
    </nav>
  );
}
