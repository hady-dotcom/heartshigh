import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { collectionsNeedingWipe } from './relations'
import { registeredSlugs, wipeEntries, wipeEntry } from './registry'
import { missingWipeRegistrations } from './service'
import { confirmMatches, refusePortalDelete } from './permissions'
import { TENANT_COLLECTIONS } from '../../lib/tenant-collections'

describe('erase registry', () => {
  it('registers every collection that stores a portal or a user', () => {
    const missing = missingWipeRegistrations()
    assert.deepEqual(missing, [], `Add registerWipe() for: ${missing.join(', ')}`)
  })

  it('covers every multi-tenant collection so later PRs fail if they skip a wipe rule', () => {
    const registered = registeredSlugs()
    const skipped = Object.keys(TENANT_COLLECTIONS).filter((slug) => !registered.has(slug))
    assert.deepEqual(skipped, [])
  })

  it('deletes circle answers for a person instead of keeping them anonymised', () => {
    const entry = wipeEntry('circle-answers')
    assert.ok(entry)
    const user = Array.isArray(entry.user) ? entry.user : [entry.user]
    assert.ok(user.some((rule) => rule?.kind === 'hard-delete' && rule.field === 'author'))
  })

  it('unlinks shared library talks and keeps local courses as a hard delete', () => {
    const lessons = wipeEntry('lessons')
    const courses = wipeEntry('courses')
    const portalLessons = Array.isArray(lessons?.portal) ? lessons.portal : [lessons?.portal]
    const portalCourses = Array.isArray(courses?.portal) ? courses.portal : [courses?.portal]
    assert.ok(portalLessons.some((rule) => rule?.kind === 'unlink'))
    assert.ok(portalLessons.some((rule) => rule?.kind === 'hard-delete'))
    assert.ok(portalCourses.some((rule) => rule?.kind === 'unlink'))
    assert.ok(portalCourses.some((rule) => rule?.kind === 'hard-delete' && rule.extra?.includes("origin = 'local'")))
  })

  it('lists a plug-in comment for the unmerged PRs', () => {
    assert.ok(wipeEntries().length > 20)
    const needed = collectionsNeedingWipe()
    assert.ok(needed.has('answers'))
    assert.ok(needed.has('gather-rsvps'))
    assert.ok(needed.has('compass-attempts'))
  })
})

describe('erase permissions', () => {
  it('only the master desk may delete a portal', () => {
    assert.equal(refusePortalDelete(null), 'Please sign in first.')
    assert.equal(refusePortalDelete({ id: 2, email: 'a@b.c', role: 'portal-admin' }), 'Only the master desk can delete a portal.')
    assert.equal(refusePortalDelete({ id: 1, email: 'm@b.c', role: 'master' }), null)
  })

  it('confirm matches the name without worrying about case', () => {
    assert.equal(confirmMatches('Harbour Mosque', 'harbour mosque'), true)
    assert.equal(confirmMatches('harbour', 'Harbour Mosque'), false)
  })
})
