import Link from 'next/link'

export function Pager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null
  return (
    <nav className="page-row" aria-label="Pages" data-testid="pager">
      {page > 1 ? <Link className="btn ghost small" href={hrefFor(page - 1)} data-testid="page-back">Back</Link> : null}
      <span data-testid="page-status">Page {page} of {pages}</span>
      {page < pages ? <Link className="btn ghost small" href={hrefFor(page + 1)} data-testid="page-next">Next</Link> : null}
    </nav>
  )
}
