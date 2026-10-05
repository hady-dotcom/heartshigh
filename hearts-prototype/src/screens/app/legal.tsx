import Link from 'next/link'
import { AppFrame, Back } from '@/components/app/shell'
import { LegalLinks } from '@/components/app/legal-links'
import { PageHelp } from '@/components/app/page-help'
import { learnerHelp } from '@/lib/learner-help'
import { renderLegalMarkdown, type LegalKind } from '@/lib/legal'
import { loadPortalContacts, publishedLegal } from '@/server/consent'
import type { Ctx } from '../common'

const TITLES: Record<LegalKind, string> = {
  privacy: 'Privacy',
  terms: 'Terms',
  guidelines: 'How we speak',
  'portal-agreement': 'Running HEARTS',
}

export async function LegalScreen({ payload, portal, base, slug }: { payload: Ctx['payload']; portal?: Ctx['portal'] | null; base: string; slug?: string }, kind: LegalKind) {
  const page = await publishedLegal(payload, kind)
  const contacts = portal?.id ? await loadPortalContacts(payload, portal.id) : null
  const title = page?.title || TITLES[kind]
  const summary = page?.summary || 'The full wording is a tap below.'
  const body = page?.body || 'This page is being written. Please check again soon.'
  const testId = kind === 'portal-agreement' ? 'running' : kind
  return (
    <AppFrame testId={testId} evening>
      <div className="app-scroll legal-page">
        {base ? <Back href={base} label="Home" /> : <p className="door-links"><Link href="/">Back</Link></p>}
        <div className="app-head">
          <h1>{title}</h1>
          <PageHelp topic={testId}>{learnerHelp(testId)}</PageHelp>
        </div>
        {page?.draftForAdviserReview !== false ? (
          <p className="legal-draft" data-testid="legal-draft">Draft for adviser review</p>
        ) : null}
        <p className="lede" data-testid="legal-summary">{summary}</p>
        <p className="muted" data-testid="legal-version">Version {page?.version || 'draft'}{page?.updatedLabel ? ` · ${page.updatedLabel}` : ''}</p>
        {kind === 'privacy' && contacts?.privacyName ? (
          <p className="card" data-testid="privacy-contact">
            Privacy contact for this portal: <b>{contacts.privacyName}</b>
            {contacts.privacyEmail ? <> · <a href={`mailto:${contacts.privacyEmail}`}>{contacts.privacyEmail}</a></> : null}
          </p>
        ) : null}
        {kind === 'guidelines' && contacts?.safeguardingName ? (
          <p className="card" data-testid="safeguarding-contact">
            Safeguarding lead: <b>{contacts.safeguardingName}</b>
            {contacts.safeguardingEmail ? <> · <a href={`mailto:${contacts.safeguardingEmail}`}>{contacts.safeguardingEmail}</a></> : null}
            {contacts.safeguardingPhone ? <> · {contacts.safeguardingPhone}</> : null}
          </p>
        ) : null}
        <article className="legal-body" data-testid="legal-body" dangerouslySetInnerHTML={{ __html: renderLegalMarkdown(body) }} />
        <LegalLinks slug={slug || portal?.slug} />
      </div>
    </AppFrame>
  )
}
