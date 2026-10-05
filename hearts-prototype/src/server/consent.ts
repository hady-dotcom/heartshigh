import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Where } from 'payload'
import { now } from '@/lib/clock'
import { cookieSectionMarkdown, DEFAULT_LEGAL_VERSION, LEARNER_CONSENT_KINDS, type LegalKind } from '@/lib/legal'
import { type AgeState, type CurrentLegal, type RecordedConsent, childState, guardianIsInPlace, missingLearnerConsents } from '@/lib/consent'
import { payloadSecret } from '@/lib/env'
import { clientIp } from '@/lib/rate-limit'
import { portalIdOf } from '@/lib/ids'
import type { Session, SessionUser } from './context'
import { audit } from './viewas'

type Payload = Session['payload']

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const FILES: Record<LegalKind, { file: string; title: string; summary: string }> = {
  privacy: {
    file: 'content/legal/privacy.md',
    title: 'Privacy notice',
    summary: 'What we keep, why, who can see it, how long, and your choices.',
  },
  terms: {
    file: 'content/legal/terms.md',
    title: 'Terms of use',
    summary: 'Be kind. Do not sell. Do not share other people’s answers.',
  },
  guidelines: {
    file: 'content/legal/guidelines.md',
    title: 'How we speak to each other here',
    summary: 'Adab, no harm, no selling, and how a concern is looked at.',
  },
  'portal-agreement': {
    file: 'content/legal/portal-agreement.md',
    title: 'Running HEARTS in your community',
    summary: 'You look after the people. HEARTS hosts and protects the data.',
  },
}

export function hashIp(ip: string) {
  if (!ip) return ''
  return createHash('sha256').update(`${payloadSecret()}:ip:${ip}`).digest('hex').slice(0, 40)
}

export function hashToken(token: string) {
  return createHash('sha256').update(`${payloadSecret()}:guardian:${token}`).digest('hex')
}

export function newGuardianToken() {
  const token = randomBytes(24).toString('hex')
  return { token, hash: hashToken(token), expiresAt: new Date(now().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() }
}

export function draftBody(kind: LegalKind) {
  const meta = FILES[kind]
  const text = readFileSync(path.join(root, meta.file), 'utf8')
  return kind === 'privacy' && !text.includes('## Cookies and storage') ? `${text.trim()}\n\n${cookieSectionMarkdown()}` : text
}

export async function currentLegalPages(payload: Payload, kinds: LegalKind[] = [...LEARNER_CONSENT_KINDS, 'guidelines']): Promise<CurrentLegal[]> {
  await ensureLegalPages(payload)
  const found = await payload.find({
    collection: 'legal-pages',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    sort: '-updatedAt',
    where: { and: [{ published: { equals: true } }, { kind: { in: kinds } }] },
  })
  const latest = new Map<string, CurrentLegal>()
  for (const row of found.docs as { kind?: string; version?: string; summary?: string; title?: string }[]) {
    if (!row.kind || !row.version || latest.has(row.kind)) continue
    latest.set(row.kind, { kind: row.kind as LegalKind, version: row.version, summary: row.summary || '', title: row.title || row.kind })
  }
  return kinds.map((kind) => latest.get(kind)).filter((row): row is CurrentLegal => Boolean(row))
}

export async function publishedLegal(payload: Payload, kind: LegalKind) {
  const found = await payload.find({
    collection: 'legal-pages',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    sort: '-updatedAt',
    where: { and: [{ kind: { equals: kind } }, { published: { equals: true } }] },
  })
  return (found.docs[0] as {
    id: number
    kind: LegalKind
    version: string
    title: string
    summary: string
    body: string
    draftForAdviserReview?: boolean
    updatedLabel?: string
    updatedAt?: string
  } | undefined) || null
}

export async function recordedConsents(payload: Payload, userId: number, portalId?: number | null): Promise<RecordedConsent[]> {
  const where: Where = portalId ? { and: [{ user: { equals: userId } }, { portal: { equals: portalId } }] } : { user: { equals: userId } }
  const found = await payload.find({ collection: 'consents', overrideAccess: true, depth: 0, limit: 80, sort: '-acceptedAt', where })
  return (found.docs as { kind?: string; version?: string; acceptedAt?: string }[]).map((row) => ({
    kind: String(row.kind || ''),
    version: String(row.version || ''),
    acceptedAt: row.acceptedAt || null,
  }))
}

export async function loadAgeProfile(payload: Payload, userId: number) {
  const found = await payload.find({ collection: 'age-profiles', overrideAccess: true, depth: 0, limit: 1, where: { user: { equals: userId } } })
  const row = found.docs[0] as {
    id: number
    ageBand?: string
    waitingForGuardian?: boolean
    guardianAcceptedAt?: string | null
    schoolOfflineAt?: string | null
    guardianEmail?: string | null
    portal?: unknown
  } | undefined
  if (!row) return { doc: null, age: null as AgeState | null }
  const age: AgeState = {
    ageBand: row.ageBand === 'under-13' || row.ageBand === '13-17' || row.ageBand === '18+' ? row.ageBand : null,
    waitingForGuardian: Boolean(row.waitingForGuardian),
    guardianAcceptedAt: row.guardianAcceptedAt || null,
    schoolOfflineAt: row.schoolOfflineAt || null,
    guardianEmail: row.guardianEmail || null,
  }
  return { doc: row, age }
}

export async function loadPortalContacts(payload: Payload, portalId: number) {
  const found = await payload.find({ collection: 'portal-contacts', overrideAccess: true, depth: 0, limit: 1, where: { portal: { equals: portalId } } })
  return (found.docs[0] as {
    id: number
    privacyName?: string | null
    privacyEmail?: string | null
    safeguardingName?: string | null
    safeguardingEmail?: string | null
    safeguardingPhone?: string | null
    schoolOfflineConsent?: boolean
    agreementAcceptedAt?: string | null
    agreementName?: string | null
    agreementVersion?: string | null
  } | undefined) || null
}

export async function learnerNeedsConsent(payload: Payload, user: SessionUser) {
  if (user.role !== 'learner') return false
  await ensureLegalPages(payload)
  const portalId = portalIdOf(user)
  const [current, recorded] = await Promise.all([currentLegalPages(payload), recordedConsents(payload, user.id, portalId)])
  return missingLearnerConsents(current, recorded).length > 0
}

export async function codeIsForChildren(payload: Payload, accessCodeId: number | null | undefined) {
  if (!accessCodeId) return false
  const found = await payload.find({
    collection: 'child-code-flags',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ accessCode: { equals: accessCodeId } }, { forChildren: { equals: true } }] },
  })
  return found.docs.length > 0
}

export async function recordConsent(
  payload: Payload,
  input: {
    userId: number
    portalId?: number | null
    kind: string
    version: string
    req?: Request
    byGuardian?: boolean
    guardianEmail?: string
    staffActor?: number
    note?: string
  },
) {
  const existing = await payload.find({
    collection: 'consents',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { user: { equals: input.userId } },
        { kind: { equals: input.kind } },
        { version: { equals: input.version } },
        input.portalId ? { portal: { equals: input.portalId } } : { portal: { exists: false } },
      ],
    },
  })
  if (existing.docs.length) return existing.docs[0]
  if (!input.portalId) return null
  const created = await payload.create({
    collection: 'consents',
    overrideAccess: true,
    data: {
      user: input.userId,
      portal: input.portalId,
      kind: input.kind,
      version: input.version,
      acceptedAt: now().toISOString(),
      ipHash: input.req ? hashIp(clientIp(input.req)) : '',
      byGuardian: Boolean(input.byGuardian),
      guardianEmail: input.guardianEmail || undefined,
      staffActor: input.staffActor || undefined,
      note: input.note || undefined,
    } as never,
  })
  await audit(payload, 'consent.accept', {
    actor: input.staffActor || input.userId,
    target: input.userId,
    portal: input.portalId || undefined,
    detail: { kind: input.kind, version: input.version, byGuardian: Boolean(input.byGuardian) },
  })
  return created
}

export async function ensureLegalPages(payload: Payload) {
  for (const kind of Object.keys(FILES) as LegalKind[]) {
    const have = await payload.find({
      collection: 'legal-pages',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ kind: { equals: kind } }, { version: { equals: DEFAULT_LEGAL_VERSION } }] },
    })
    if (have.docs.length) continue
    const meta = FILES[kind]
    await payload.create({
      collection: 'legal-pages',
      overrideAccess: true,
      data: {
        kind,
        version: DEFAULT_LEGAL_VERSION,
        title: meta.title,
        summary: meta.summary,
        body: draftBody(kind),
        published: true,
        draftForAdviserReview: true,
        updatedLabel: '4 October 2026',
      } as never,
    })
  }
}

export async function grantCurrentConsents(payload: Payload, userId: number, portalId?: number | null) {
  if (!portalId) return
  const pages = await currentLegalPages(payload)
  for (const page of pages) {
    if (!LEARNER_CONSENT_KINDS.includes(page.kind as (typeof LEARNER_CONSENT_KINDS)[number])) continue
    await recordConsent(payload, { userId, portalId, kind: page.kind, version: page.version })
  }
}

export async function childDefaultsFor(payload: Payload, userId: number) {
  const { age } = await loadAgeProfile(payload, userId)
  return childState(age)
}

export { guardianIsInPlace, childState }
