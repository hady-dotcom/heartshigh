import Link from 'next/link'

export function Banner({ error, notice }: { error?: string; notice?: string }) {
  return (
    <>
      {error ? <div className="error" data-testid="error">{error}</div> : null}
      {notice ? <div className="notice" data-testid="notice">{notice}</div> : null}
    </>
  )
}

export function Principle({ label, text, why }: { label: string; text: string; why: string }) {
  return (
    <section className="principle" data-testid="principle">
      <small>{label}</small>
      <p>{text}</p>
      <p className="why">Why the heart needs this: {why}</p>
    </section>
  )
}

export function Phone({ children }: { children: React.ReactNode }) {
  return <div className="phone">{children}</div>
}

export function LearnerNav({ slug }: { slug: string }) {
  const items = [
    ['Feed', `/p/${slug}/feed`],
    ['Path', `/p/${slug}/path`],
    ['Grow', `/p/${slug}/grow`],
    ['Chapter', `/p/${slug}/chapter`],
    ['Plan', `/p/${slug}/schedule`],
    ['Night', `/p/${slug}/night`],
  ]
  return (
    <nav className="nav">
      {items.map(([label, href]) => (
        <Link key={href} href={href}>{label}</Link>
      ))}
    </nav>
  )
}

export function AdminNav({ slug }: { slug: string }) {
  const items = [
    ['Home', `/p/${slug}/admin`],
    ['Courses', `/p/${slug}/admin/courses`],
    ['Adopt', `/p/${slug}/admin/adopt`],
    ['Codes', `/p/${slug}/admin/codes`],
    ['Teach', `/p/${slug}/admin/teach`],
    ['Settings', `/p/${slug}/admin/settings`],
  ]
  return (
    <nav className="nav">
      {items.map(([label, href]) => (
        <Link key={href} href={href}>{label}</Link>
      ))}
    </nav>
  )
}

export function Logout() {
  return (
    <form action="/api/hearts" method="post">
      <input type="hidden" name="action" value="logout" />
      <button className="quiet" type="submit">Sign out</button>
    </form>
  )
}
