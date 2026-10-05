import { Flash, Hidden } from '@/components/app/shell'
import { BrandLockup } from '@/components/brand'
import { getSession } from '@/server/context'
import { currentLegalPages } from '@/server/consent'

export default async function GuardianPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string; notice?: string; done?: string }> }) {
  const query = await searchParams
  const { payload } = await getSession()
  const pages = await currentLegalPages(payload)
  const done = query.done === '1'
  return (
    <main className="door garden-door" data-testid="guardian">
      <div className="door-card">
        <BrandLockup size={72} />
        <h1>A child would like to join</h1>
        <Flash error={query.error} notice={query.notice} />
        {done ? (
          <p className="lede" data-testid="guardian-done">Thank you. Your child can begin.</p>
        ) : (
          <>
            <p className="lede">Please read the short notes. If you agree, tick the box. We keep the version and the time.</p>
            <ul>
              {pages.filter((page) => page.kind === 'privacy' || page.kind === 'terms').map((page) => (
                <li key={page.kind}><b>{page.title}.</b> {page.summary} <a href={`/${page.kind}`}>Read the full page</a></li>
              ))}
            </ul>
            <form className="door-form" action="/api/hearts" method="post" data-testid="guardian-agree-form">
              <Hidden fields={{ action: 'confirm-guardian', token: query.token }} />
              <label className="consent-line">
                <input type="checkbox" name="agree" value="on" required data-testid="guardian-agree" />
                <span>I agree for my child.</span>
              </label>
              <button className="pill gold block" type="submit" data-testid="guardian-submit">I agree for my child</button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
