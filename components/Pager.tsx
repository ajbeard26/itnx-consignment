import Link from "next/link";

export default function Pager({
  page,
  pages,
  total,
  size,
  hrefFor,
}: {
  page: number;
  pages: number;
  total: number;
  size: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <nav className="pager" aria-label="Pagination">
      {pages > 1 ? (
        page > 1 ? (
          <Link href={hrefFor(page - 1)}>Previous</Link>
        ) : (
          <span className="pager-off">Previous</span>
        )
      ) : null}
      <span>
        {from}–{to} of {total}
      </span>
      {pages > 1 ? (
        page < pages ? (
          <Link href={hrefFor(page + 1)}>Next</Link>
        ) : (
          <span className="pager-off">Next</span>
        )
      ) : null}
    </nav>
  );
}
