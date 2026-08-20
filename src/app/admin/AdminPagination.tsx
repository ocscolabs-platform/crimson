import Link from "next/link";

type AdminPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
};

export default function AdminPagination({ page, pageSize, total }: AdminPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) {
    return null;
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="admin-pagination" aria-label="Audit history pagination">
      <span className="admin-pagination-range">Showing {first}–{last} of {total}</span>
      <div className="admin-pagination-actions">
        {page > 1 ? <Link href={`?audit_page=${page - 1}`}>Previous</Link> : <span aria-disabled="true">Previous</span>}
        <strong className="admin-pagination-page">Page {page} of {pageCount}</strong>
        {page < pageCount ? <Link href={`?audit_page=${page + 1}`}>Next</Link> : <span aria-disabled="true">Next</span>}
      </div>
    </nav>
  );
}
