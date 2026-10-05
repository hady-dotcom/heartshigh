import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { PageHelp } from '@/components/app/page-help'
import { learnerHelp } from '@/lib/learner-help'
import { loadPortalContacts } from '@/server/consent'
import { unreadCount, type Ctx } from '../common'

export async function HelpCentreScreen({ payload, user, portal, base, query }: Ctx) {
  const unread = await unreadCount(payload, user)
  const contacts = await loadPortalContacts(payload, portal.id)
  const here = `${base}/me/help`
  const page = typeof query.page === 'string' ? query.page : here
  return (
    <AppFrame testId="help-request" evening>
      <div className="app-scroll">
        <Back href={`${base}/me`} label="Me" />
        <div className="app-head">
          <h1>Get help</h1>
          <PageHelp topic="help">{learnerHelp('help')}</PageHelp>
        </div>
        <Flash error={query.error} notice={query.notice} />
        <p className="lede">Three doors. Pick the one that fits.</p>
        <form className="card form-stack" action="/api/hearts" method="post" data-testid="help-broken">
          <Hidden fields={{ action: 'help-request', kind: 'broken', next: here, page }} />
          <h2>Something isn’t working</h2>
          <p className="muted">Goes to HEARTS with this page, this device and the time.</p>
          <label>What happened<input className="field" name="note" maxLength={500} data-testid="help-broken-note" /></label>
          <button className="pill ink small" type="submit" data-testid="help-broken-send">Send to HEARTS</button>
        </form>
        <form className="card form-stack" action="/api/hearts" method="post" data-testid="help-learning">
          <Hidden fields={{ action: 'help-request', kind: 'learning', next: here, page }} />
          <h2>A question about my learning</h2>
          <p className="muted">Goes to your teacher as an in-app note.</p>
          <label>Your question<textarea className="field" name="note" rows={3} required data-testid="help-learning-note" /></label>
          <button className="pill ink small" type="submit" data-testid="help-learning-send">Send to your teacher</button>
        </form>
        <form className="card form-stack" action="/api/hearts" method="post" data-testid="help-worrying">
          <Hidden fields={{ action: 'help-request', kind: 'worrying', next: here, page }} />
          <h2>Something worrying</h2>
          <p className="muted">Goes to the people who look after safety. Lane C will fold this into Report when that door is live.</p>
          <label>What you want someone to know<textarea className="field" name="note" rows={3} data-testid="help-worrying-note" /></label>
          <button className="pill gold small" type="submit" data-testid="help-worrying-send">Tell a person</button>
        </form>
        {contacts?.safeguardingName ? (
          <p className="card" data-testid="safeguarding-contact">
            Safeguarding lead: <b>{contacts.safeguardingName}</b>
            {contacts.safeguardingEmail ? <> · {contacts.safeguardingEmail}</> : null}
            {contacts.safeguardingPhone ? <> · {contacts.safeguardingPhone}</> : null}
          </p>
        ) : null}
        {contacts?.privacyName ? (
          <p className="card" data-testid="privacy-contact">
            Privacy contact: <b>{contacts.privacyName}</b>
            {contacts.privacyEmail ? <> · {contacts.privacyEmail}</> : null}
          </p>
        ) : null}
      </div>
      <TabBar base={base} active="me" portal={portal} unread={unread} />
    </AppFrame>
  )
}
