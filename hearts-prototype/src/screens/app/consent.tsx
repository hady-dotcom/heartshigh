import Link from 'next/link'
import { AppFrame, Flash, Hidden } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { learnerHelp } from '@/lib/learner-help'
import { AGE_LABEL, type AgeBand } from '@/lib/child-safety'
import { currentLegalPages, loadAgeProfile, loadPortalContacts } from '@/server/consent'
import { codeIsForChildren } from '@/server/consent-actions'
import { portalIdOf } from '@/lib/ids'
import type { Ctx } from '../common'

export async function ConsentScreen({ payload, user, portal, base, query }: Ctx) {
  const pages = await currentLegalPages(payload)
  const { age } = await loadAgeProfile(payload, user.id)
  const contacts = await loadPortalContacts(payload, portal.id)
  const codeId = typeof user.accessCode === 'object' && user.accessCode && 'id' in user.accessCode ? Number(user.accessCode.id) : Number(user.accessCode || 0)
  const childCode = await codeIsForChildren(payload, codeId || null)
  const preset: AgeBand | null = childCode ? 'under-13' : age?.ageBand || null
  const need = query.need
  const guardianToken = typeof query.guardian === 'string' ? query.guardian : ''
  const after = typeof query.after === 'string' && query.after.startsWith('/') ? query.after : base
  const waiting = need === 'guardian' || (age?.ageBand === 'under-13' && !age.guardianAcceptedAt && !age.schoolOfflineAt)
  return (
    <AppFrame testId="consent" evening>
      <div className="app-scroll">
        <div className="app-head">
          <h1>Before you begin</h1>
          <PageHelp topic="consent">{learnerHelp('consent')}</PageHelp>
        </div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lede">A short note on how we look after each other, then one tick.</p>
        <ul className="consent-summaries" data-testid="consent-summaries">
          {pages.filter((page) => page.kind === 'privacy' || page.kind === 'terms').map((page) => (
            <li key={page.kind} className="card">
              <b>{page.title}</b>
              <p>{page.summary}</p>
              <Link href={`${base}/${page.kind === 'terms' ? 'terms' : 'privacy'}`} data-testid={`consent-read-${page.kind}`}>Read the full page</Link>
            </li>
          ))}
          <li className="card">
            <b>How we speak</b>
            <p>{pages.find((page) => page.kind === 'guidelines')?.summary || 'Adab, no harm, no selling.'}</p>
            <Link href={`${base}/guidelines`}>Read the guidelines</Link>
          </li>
        </ul>
        {waiting && need !== 'school' ? (
          <form className="card form-stack" action="/api/hearts" method="post" data-testid="guardian-form">
            <Hidden fields={{ action: 'request-guardian', next: `${base}/consent` }} />
            <p>Someone 12 or under needs a grown-up to agree. We will write to them with the same short note.</p>
            <label>Grown-up’s email<input className="field" type="email" name="guardianEmail" required data-testid="guardian-email" defaultValue={age?.guardianEmail || ''} /></label>
            <button className="pill gold block" type="submit" data-testid="guardian-send">Write to a grown-up</button>
            {guardianToken ? (
              <p className="muted" data-testid="guardian-link">
                Email is not on. Share this link: <Link href={`/guardian?token=${encodeURIComponent(guardianToken)}`}>I agree for my child</Link>
              </p>
            ) : null}
            {contacts?.schoolOfflineConsent ? <p className="muted">Or your school can tick this on paper.</p> : null}
          </form>
        ) : null}
        {need === 'school' ? (
          <p className="card" data-testid="school-wait">Your school collects this on paper. You can watch in the meantime. Answers stay with you until they tick the box.</p>
        ) : null}
        <form className="card form-stack" action="/api/hearts" method="post" data-testid="consent-form">
          <Hidden fields={{ action: 'accept-consent', after, next: `${base}/consent` }} />
          <fieldset className="age-bands" data-testid="age-bands">
            <legend>How old are you?</legend>
            {(['under-13', '13-17', '18+'] as AgeBand[]).map((band) => (
              <label key={band} className="check">
                <input type="radio" name="ageBand" value={band} required defaultChecked={preset === band} data-testid={`age-${band}`} />
                {AGE_LABEL[band]}
              </label>
            ))}
          </fieldset>
          <label className="consent-line">
            <input type="checkbox" name="agree" value="on" required data-testid="consent-agree" />
            <span>I agree. Let’s begin.</span>
          </label>
          <button className="pill gold block" type="submit" data-testid="consent-submit">I agree, let’s begin</button>
        </form>
        {portalIdOf(user) ? <p className="muted">We keep the version and the time, so we can show that you agreed.</p> : null}
      </div>
    </AppFrame>
  )
}
