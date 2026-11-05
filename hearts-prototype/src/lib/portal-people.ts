import type { Payload } from 'payload'
import { BOOK_SWARM } from './book-swarm'
import { WORKBOOK_FILMS, workbookParentEmail } from './demo-workbook'
import { DEMO_EMAIL_SUFFIX } from './env'
import { SWARM_PARENTS } from './swarm-plan'

export type PortalPerson = {
  email?: string | null
  role?: string | null
  removed?: boolean | null
}

export type PortalPeopleTally = {
  /** Real learners plus the portal team. Sample people and demo sign-ins are not included. */
  joined: number
  learners: number
  team: number
  sample: number
  demo: number
}

let roster: Set<string> | null = null

/** Emails of the handwritten parents placed on the films. They are not accounts someone opened. */
export function sampleParentEmails() {
  if (roster) return roster
  const emails = new Set<string>()
  for (const film of WORKBOOK_FILMS) for (const row of film.others) emails.add(workbookParentEmail(row.name))
  for (const film of BOOK_SWARM) for (const row of film.others) emails.add(workbookParentEmail(row.name))
  for (const parent of SWARM_PARENTS) emails.add(parent.email.trim().toLowerCase())
  roster = emails
  return emails
}

export function tallyPortalPeople(people: PortalPerson[], sample = sampleParentEmails()): PortalPeopleTally {
  const tally: PortalPeopleTally = { joined: 0, learners: 0, team: 0, sample: 0, demo: 0 }
  for (const person of people) {
    if (person.removed === true) continue
    const email = String(person.email || '').trim().toLowerCase()
    if (sample.has(email)) {
      tally.sample += 1
      continue
    }
    if (email.endsWith(DEMO_EMAIL_SUFFIX)) {
      tally.demo += 1
      continue
    }
    tally.joined += 1
    if (!person.role || person.role === 'learner') tally.learners += 1
    else tally.team += 1
  }
  return tally
}

export function portalPeopleNote(tally: PortalPeopleTally) {
  const who: string[] = []
  if (tally.learners) who.push(`${tally.learners} ${tally.learners === 1 ? 'learner has' : 'learners have'} joined`)
  if (tally.team) who.push(`${tally.team} ${tally.team === 1 ? 'person is' : 'people are'} on the team`)
  const head = who.length ? `${who.join(', and ')}.` : 'Nobody has joined yet.'
  const aside: string[] = []
  if (tally.sample) aside.push(`${tally.sample} sample ${tally.sample === 1 ? 'person is' : 'people are'} on the films and not counted`)
  if (tally.demo) aside.push(`${tally.demo} demo ${tally.demo === 1 ? 'sign-in is' : 'sign-ins are'} not counted`)
  if (!aside.length && !who.length) return ''
  if (!aside.length) return head
  return `${head} ${aside.join('. ')}.`
}

/** Everyone attached to this portal, including sample people. The tally decides who counts. */
export async function loadPortalPeople(payload: Payload, portalId: number) {
  const people: PortalPerson[] = []
  let page = 1
  for (;;) {
    const found = await payload.find({
      collection: 'users',
      overrideAccess: true,
      depth: 0,
      limit: 200,
      page,
      where: { 'tenants.tenant': { equals: portalId } },
    })
    for (const doc of found.docs) {
      const row = doc as { email?: unknown; role?: unknown; removed?: unknown }
      people.push({
        email: typeof row.email === 'string' ? row.email : '',
        role: typeof row.role === 'string' ? row.role : '',
        removed: row.removed === true,
      })
    }
    if (!found.hasNextPage) break
    page += 1
    if (page > 40) break
  }
  return people
}
