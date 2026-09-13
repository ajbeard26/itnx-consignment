import Link from "next/link";

export default function Pager({
  page,
  pages,
  total,
  hrefFor,
}: {
  page: number;
  pages: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= 0 || pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)}>Previous</Link>
      ) : (
        <span className="pager-off">Previous</span>
      )}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)}>Next</Link>
      ) : (
        <span className="pager-off">Next</span>
      )}
    </nav>
  );
}
