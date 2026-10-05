import { Hidden } from '@/components/app/shell'
import { HelpTip } from '@/components/desk/help'
import { guardianStatusLabel } from '@/lib/consent'
import { PAGE } from '@/lib/desk-help'
import { loadAgeProfile, loadPortalContacts, recordedConsents } from '@/server/consent'
import { type Ctx, longDate, portalPeople, rows, str } from '../common'
import { AdminFrame } from './overview'

export async function PortalContactsScreen(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const contacts = await loadPortalContacts(payload, portal.id)
  const agreement = await payload.find({
    collection: 'legal-pages',
    overrideAccess: true,
    limit: 1,
    sort: '-updatedAt',
    where: { and: [{ kind: { equals: 'portal-agreement' } }, { published: { equals: true } }] },
  })
  const agreementDoc = agreement.docs[0] as { summary?: string; version?: string } | undefined
  const missing = !contacts?.privacyName || !contacts?.safeguardingName
  return (
    <AdminFrame ctx={ctx} active="contacts" title="Contacts" intro="Who people can turn to." testId="admin-contacts">
      {missing ? <p className="flash error" data-testid="contacts-missing">Name a privacy contact and a safeguarding lead before this portal opens to learners.</p> : null}
      <section className="panel">
        <header className="light"><h2>Privacy and safeguarding <HelpTip topic="contacts">{PAGE.contacts}</HelpTip></h2></header>
        <form className="body form" action="/api/hearts" method="post" data-testid="contacts-form">
          <Hidden fields={{ action: 'save-portal-contacts', portalId: portal.id, next: `${base}/admin/contacts` }} />
          <label className="row"><span>Privacy contact name</span><input className="field" name="privacyName" required defaultValue={str(contacts?.privacyName)} data-testid="privacy-name" /></label>
          <label className="row"><span>Privacy contact email</span><input className="field" type="email" name="privacyEmail" required defaultValue={str(contacts?.privacyEmail)} data-testid="privacy-email" /></label>
          <label className="row"><span>Safeguarding lead name</span><input className="field" name="safeguardingName" required defaultValue={str(contacts?.safeguardingName)} data-testid="safeguarding-name" /></label>
          <label className="row"><span>Safeguarding lead email</span><input className="field" type="email" name="safeguardingEmail" required defaultValue={str(contacts?.safeguardingEmail)} data-testid="safeguarding-email" /></label>
          <label className="row"><span>Safeguarding phone</span><input className="field" name="safeguardingPhone" required defaultValue={str(contacts?.safeguardingPhone)} data-testid="safeguarding-phone" /></label>
          <label className="check"><input type="checkbox" name="schoolOfflineConsent" defaultChecked={Boolean(contacts?.schoolOfflineConsent)} data-testid="school-offline" /> The school collects parental consent offline</label>
          <div className="actions"><button className="btn ink" type="submit" data-testid="save-contacts">Save contacts</button></div>
        </form>
      </section>
      <section className="panel" style={{ marginTop: 18 }}>
        <header className="light"><h2>Running HEARTS in your community</h2></header>
        <form className="body form" action="/api/hearts" method="post" data-testid="agreement-form">
          <Hidden fields={{ action: 'portal-agreement', portalId: portal.id, next: `${base}/admin/contacts` }} />
          <p>{agreementDoc?.summary || 'You look after the people. HEARTS hosts and protects the data.'}</p>
          <p className="hint">Draft for adviser review. Version {agreementDoc?.version || 'draft'}.</p>
          {contacts?.agreementAcceptedAt ? <p data-testid="agreement-done">{contacts.agreementName} agreed on {longDate(contacts.agreementAcceptedAt)}.</p> : null}
          <label className="row"><span>Your name</span><input className="field" name="agreementName" required defaultValue={str(contacts?.agreementName)} data-testid="agreement-name" /></label>
          <label className="check"><input type="checkbox" name="agree" required data-testid="agreement-tick" /> I have read this page and our community will look after the people who join</label>
          <div className="actions"><button className="btn ink" type="submit" data-testid="save-agreement">Record agreement</button></div>
        </form>
      </section>
    </AdminFrame>
  )
}

export async function ChildrenScreen(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const contacts = await loadPortalContacts(payload, portal.id)
  const people = (await portalPeople(payload, portal.id)).filter((person) => person.role === 'learner')
  const codes = await rows(payload, 'access-codes', { portal: { equals: portal.id } }, { sort: 'code' })
  const flags = await rows(payload, 'child-code-flags', {}, { limit: 200 })
  const flagged = new Set(flags.filter((row) => row.forChildren).map((row) => Number(typeof row.accessCode === 'object' && row.accessCode && 'id' in (row.accessCode as object) ? (row.accessCode as { id: number }).id : row.accessCode)))
  const childRows = await Promise.all(
    people.map(async (learner) => {
      const { age } = await loadAgeProfile(payload, learner.id)
      return { learner, age, label: guardianStatusLabel(age) }
    }),
  )
  return (
    <AdminFrame ctx={ctx} active="children" title="Children" intro="Age bands, guardian consent, and codes meant for children." testId="admin-children">
      <section className="panel">
        <header className="light"><h2>How this portal collects consent <HelpTip topic="children">{PAGE.children}</HelpTip></h2></header>
        <form className="body form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'save-children-settings', portalId: portal.id, next: `${base}/admin/children` }} />
          <label className="check">
            <input type="checkbox" name="schoolOfflineConsent" defaultChecked={Boolean(contacts?.schoolOfflineConsent)} data-testid="school-offline" />
            The school collects parental consent offline
          </label>
          <p className="hint">Most madrasahs work this way. Tick a child below when the paper form is in.</p>
          <div className="actions"><button className="btn ink" type="submit" data-testid="save-children">Save</button></div>
        </form>
      </section>
      <section className="panel" style={{ marginTop: 18 }}>
        <header className="light"><h2>Learners</h2></header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Name</th><th>Guardian consent</th><th /></tr></thead>
            <tbody>
              {childRows.map(({ learner, age, label }) => (
                  <tr key={learner.id} data-testid="child-row">
                    <td><b>{str(learner.name)}</b><div className="hint">{age?.ageBand || 'Age not asked yet'}</div></td>
                    <td data-testid="guardian-status">{label}</td>
                    <td>
                      {contacts?.schoolOfflineConsent && age?.ageBand === 'under-13' && !age.guardianAcceptedAt && !age.schoolOfflineAt ? (
                        <form action="/api/hearts" method="post">
                          <Hidden fields={{ action: 'staff-guardian-consent', learner: learner.id, portalId: portal.id, next: `${base}/admin/children` }} />
                          <input className="field" name="note" placeholder="Date on the paper form" data-testid="offline-note" />
                          <button className="btn ghost small" type="submit" data-testid="offline-tick">Record paper consent</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
              ))}
              {!people.length ? <tr><td colSpan={3} className="empty">Nobody has joined yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 18 }}>
        <header className="light"><h2>Codes for children</h2></header>
        <form className="body child-codes" action="/api/hearts" method="post" data-testid="child-codes-form">
          <Hidden fields={{ action: 'mark-child-codes', next: `${base}/admin/children`, codeIds: codes.map((code) => code.id).join(',') }} />
          <ul className="child-code-list">
            {codes.map((code) => (
              <li key={code.id} className="child-code-row" data-testid="child-code-row">
                <span><b>{str(code.code)}</b> · {str(code.label) || str(code.role)}</span>
                <label className="consent-line">
                  <input type="checkbox" name="childCodes" value={String(code.id)} defaultChecked={flagged.has(code.id)} data-testid="child-code-flag" />
                  <span>For children</span>
                </label>
              </li>
            ))}
          </ul>
          {codes.length ? (
            <div className="actions"><button className="btn ink" type="submit" data-testid="save-child-codes">Save codes</button></div>
          ) : (
            <p className="hint">No codes yet.</p>
          )}
        </form>
      </section>
    </AdminFrame>
  )
}

export async function learnerConsentHint(payload: Ctx['payload'], learnerId: number, portalId: number) {
  const [recorded, { age }] = await Promise.all([recordedConsents(payload, learnerId, portalId), loadAgeProfile(payload, learnerId)])
  const privacy = recorded.find((row) => row.kind === 'privacy')
  return {
    agreed: privacy ? 'Agreed' : 'Waiting',
    detail: privacy
      ? `Agreed ${privacy.acceptedAt ? longDate(privacy.acceptedAt) : ''}, version ${privacy.version}. Guardian consent: ${guardianStatusLabel(age)}`
      : `Not yet agreed. Guardian consent: ${guardianStatusLabel(age)}`,
    guardian: guardianStatusLabel(age),
  }
}
