import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { classColour } from '@/lib/class-palette'
import { bulkConfirmLine, bulkProblems, parseIdList, type BulkAction } from '@/lib/bulk-people'
import { previewPeopleRows, readPeopleList } from '@/lib/people-sheet'
import { authorTextProblems } from '@/lib/opening-data'
import { FEATURE_UNAVAILABLE } from '@/lib/features'
import { idOf, portalIdOf } from '@/lib/ids'
import { flattenSlots, plural, splitEvenly, studyDates } from '@/lib/schedule'
import { minutesADay } from '@/lib/study-plan'
import { audit, markSkipAudit } from './audit'
import { addPeopleToClass, assignJoinerToClass, classById, classesInPortal, createClass, removePeopleFromClass, setJoinRule } from './classes'
import type { Session, SessionUser } from './context'
import { adoptedCourseIds, visibleCourseIds } from './context'
import { refuseFeature, loadPortalById } from './features'
import { recordOpsEvent } from './ops'
import { createImportedUser, peopleInScope, staffMayTouchPerson, temporaryPassword } from './people'
import { runRetention } from './retention'
import { emptyTrash, listTrash, loadTrashDoc, moveToTrash, portalOfTrashDoc, restoreFromTrash } from './trash'
import { isTrashCollection, staffMayUseTrash } from '@/lib/trash'

type Redirect = (path: string, error?: string, notice?: string) => Response

const ACTIONS = new Set([
  'people-import-preview',
  'people-import-apply',
  'people-bulk',
  'class-create',
  'class-update',
  'class-delete',
  'class-members',
  'class-join-rule',
  'retention-run',
  'ops-record',
  'trash-remove',
  'trash-restore',
  'trash-empty',
])

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

function safeNext(next: string) {
  const value = (next || '/').trim() || '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

async function findDoc(payload: Payload, collection: string, id: number) {
  if (!id) return null
  return (await payload.findByID({ collection: collection as never, id, overrideAccess: true, depth: 0 }).catch(() => null)) as (Record<string, unknown> & { id: number }) | null
}

async function actingPortal(payload: Payload, user: SessionUser, form: FormData) {
  const slug = text(form, 'portalSlug')
  if (user.role !== 'master') {
    const mine = portalIdOf(user)
    if (!mine) return { error: 'Your account is not in a portal.' as const }
    const doc = await payload.findByID({ collection: 'portals', id: mine, overrideAccess: true, depth: 0 })
    const portal = doc as { id: number; slug?: string }
    if (slug && portal.slug !== slug) return { error: 'That portal is not yours.' as const }
    return { portal: { id: portal.id, slug: portal.slug || '' } }
  }
  if (!slug) return { error: 'Name the portal address.' as const }
  const found = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: slug } } })
  const portal = found.docs[0] as { id: number; slug?: string } | undefined
  if (!portal) return { error: 'That portal could not be found.' as const }
  return { portal: { id: portal.id, slug: portal.slug || '' } }
}

function staffOnly(user: SessionUser | null) {
  return user && user.role !== 'learner'
}

async function orderedLessons(payload: Payload, courseIds: number[]) {
  const lessons = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    sort: 'order',
    where: { course: { in: courseIds } },
  })
  return lessons.docs as { id: number; title?: string }[]
}

async function notify(payload: Payload, input: { user: number; portal: number; title: string; body: string; href: string }) {
  await payload.create({
    collection: 'notifications',
    overrideAccess: true,
    data: { ...input, channel: 'in-app', read: false, key: `bulk-${input.user}-${Date.now()}` } as never,
  })
}

export async function handleAdminActions(
  action: string,
  form: FormData,
  session: Session,
  req: Request,
  redirectTo: Redirect,
) {
  if (!ACTIONS.has(action)) return null
  const next = safeNext(text(form, 'next'))
  const { payload, user } = session
  if (!user || !staffOnly(user)) return redirectTo('/login', 'Please sign in first.')

  if (action === 'ops-record') {
    if (user.role !== 'master') return redirectTo(next, 'Only the master desk records backups.')
    const kind = text(form, 'kind') === 'restore' ? 'restore' : 'backup'
    const ok = text(form, 'ok') !== 'no'
    const detail = { source: text(form, 'source'), rows: text(form, 'rows'), files: text(form, 'files') }
    await recordOpsEvent(payload, kind, { ok, detail })
    await audit(payload, kind === 'restore' ? 'ops.restore' : 'ops.backup', { actor: user, actorRole: user.role, detail: { ...detail, ok } })
    return redirectTo(next, undefined, ok ? 'The drill is on the System page.' : 'The failed drill is on the System page.')
  }

  if (action === 'retention-run') {
    if (user.role !== 'master') return redirectTo(next, 'Only the master desk runs the clean-up.')
    await runRetention(payload, user)
    return redirectTo(next, undefined, 'The clean-up ran. Old rows that were due have been removed.')
  }

  if (action === 'trash-remove' || action === 'trash-restore' || action === 'trash-empty') {
    if (!staffMayUseTrash(user.role)) return redirectTo(next, 'Recently removed is for the portal admin.')
    const collection = text(form, 'collection')
    const id = Number(text(form, 'id') || 0)
    if (action === 'trash-empty' && text(form, 'scope') === 'all') {
      if (user.role !== 'master') return redirectTo(next, 'Only the master desk empties every portal.')
      if (text(form, 'confirm') !== 'yes') return redirectTo(next, 'Type yes to empty Recently removed. Nothing was removed.')
      const items = await listTrash(payload, null)
      const removed = await emptyTrash(payload, items)
      await audit(payload, 'trash.empty', { actor: user, actorRole: user.role, detail: { count: removed, scope: 'all' } })
      return redirectTo(next, undefined, removed ? `${removed === 1 ? '1 item was' : `${removed} items were`} emptied.` : 'Recently removed was already empty.')
    }
    const acting = await actingPortal(payload, user, form).catch(() => null)
    const portalId = acting && 'portal' in acting ? acting.portal.id : user.role === 'master' ? null : portalIdOf(user)
    if (user.role !== 'master' && !portalId) return redirectTo(next, 'Your account is not in a portal.')

    if (action === 'trash-empty') {
      if (text(form, 'confirm') !== 'yes') return redirectTo(next, 'Type yes to empty Recently removed. Nothing was removed.')
      const items = (await listTrash(payload, portalId)).filter((item) => !collection || item.collection === collection)
      const removed = await emptyTrash(payload, items)
      await audit(payload, 'trash.empty', { actor: user, actorRole: user.role, portal: portalId || undefined, detail: { count: removed, collection: collection || 'all' } })
      return redirectTo(next, undefined, removed ? `${removed === 1 ? '1 item was' : `${removed} items were`} emptied.` : 'Nothing in that group was waiting.')
    }

    if (!isTrashCollection(collection) || !id) return redirectTo(next, 'Choose something from Recently removed.')
    const doc = await loadTrashDoc(payload, collection, id)
    if (!doc) return redirectTo(next, 'That item could not be found.')
    const itemPortal = await portalOfTrashDoc(payload, collection, doc)
    if (user.role !== 'master' && itemPortal && itemPortal !== portalId) return redirectTo(next, 'That item is not in this portal.')
    if (user.role !== 'master' && !itemPortal && collection !== 'units' && collection !== 'engagement-points') {
      return redirectTo(next, 'That item is not in this portal.')
    }

    if (action === 'trash-remove') {
      await moveToTrash(payload, collection, id)
      await audit(payload, 'trash.remove', { actor: user, actorRole: user.role, portal: itemPortal || portalId || undefined, detail: { collection, id } })
      return redirectTo(next, undefined, 'It is in Recently removed for 30 days.')
    }

    await restoreFromTrash(payload, collection, id)
    await audit(payload, 'trash.restore', { actor: user, actorRole: user.role, portal: itemPortal || portalId || undefined, detail: { collection, id } })
    return redirectTo(next, undefined, 'Restored. It is back where it was.')
  }

  const acting = await actingPortal(payload, user, form)
  if ('error' in acting) return redirectTo(next, acting.error)
  const portalId = acting.portal.id

  if (action === 'class-create') {
    const name = text(form, 'name')
    if (!name) return redirectTo(next, 'Give the class a name.')
    const wording = authorTextProblems([['Name', name]])
    if (wording.length) return redirectTo(next, wording[0])
    const teacherIds = parseIdList(form.getAll('teacher'))
    const learnerIds = parseIdList(form.getAll('learner'))
    const created = await createClass(payload, {
      portal: portalId,
      name,
      colour: classColour(text(form, 'colour')),
      teachers: teacherIds,
      learners: learnerIds,
      note: text(form, 'note').slice(0, 240),
    })
    await audit(payload, 'class.create', { actor: user, actorRole: user.role, portal: portalId, detail: { id: created.id, name } })
    return redirectTo(next, undefined, `${name} is ready.`)
  }

  if (action === 'class-update') {
    const row = await classById(payload, Number(text(form, 'class')))
    if (!row || idOf(row.portal) !== portalId) return redirectTo(next, 'That class is not in this portal.')
    const name = text(form, 'name') || String(row.name || '')
    const wording = authorTextProblems([['Name', name]])
    if (wording.length) return redirectTo(next, wording[0])
    await payload.update({
      collection: 'classes' as never,
      id: row.id,
      overrideAccess: true,
      data: { name, colour: classColour(text(form, 'colour') || String(row.colour || '')), note: text(form, 'note').slice(0, 240) } as never,
    })
    await audit(payload, 'class.update', { actor: user, actorRole: user.role, portal: portalId, detail: { id: row.id, name } })
    return redirectTo(next, undefined, 'Class saved.')
  }

  if (action === 'class-delete') {
    const row = await classById(payload, Number(text(form, 'class')))
    if (!row || idOf(row.portal) !== portalId) return redirectTo(next, 'That class is not in this portal.')
    await payload.delete({ collection: 'classes' as never, id: row.id, overrideAccess: true })
    await audit(payload, 'class.delete', { actor: user, actorRole: user.role, portal: portalId, detail: { id: row.id, name: row.name } })
    return redirectTo(next, undefined, 'That class has been removed. The people are still in the portal.')
  }

  if (action === 'class-members') {
    const row = await classById(payload, Number(text(form, 'class')))
    if (!row || idOf(row.portal) !== portalId) return redirectTo(next, 'That class is not in this portal.')
    const ids = parseIdList(form.getAll('person'))
    if (text(form, 'op') === 'remove') await removePeopleFromClass(payload, row.id, ids)
    else await addPeopleToClass(payload, row.id, ids)
    await audit(payload, 'class.members', { actor: user, actorRole: user.role, portal: portalId, detail: { id: row.id, ids, op: text(form, 'op') || 'add' } })
    return redirectTo(next, undefined, 'Class members updated.')
  }

  if (action === 'class-join-rule') {
    if (user.role === 'teacher') return redirectTo(next, 'A portal admin sets which code joins a class.')
    const codeId = Number(text(form, 'code'))
    const classId = Number(text(form, 'class') || 0)
    const code = await findDoc(payload, 'access-codes', codeId)
    if (!code || idOf(code.portal) !== portalId) return redirectTo(next, 'That access code is not in this portal.')
    if (classId) {
      const row = await classById(payload, classId)
      if (!row || idOf(row.portal) !== portalId) return redirectTo(next, 'That class is not in this portal.')
    }
    await setJoinRule(payload, portalId, codeId, classId || null)
    await audit(payload, 'class.join-rule', { actor: user, actorRole: user.role, portal: portalId, detail: { code: codeId, class: classId || null } })
    return redirectTo(next, undefined, classId ? 'New joiners on that code will land in the class.' : 'New joiners on that code are no longer added to a class.')
  }

  if (action === 'people-import-preview') {
    if (user.role === 'teacher') return redirectTo(next, 'A portal admin adds people from a list.')
    const file = form.get('file')
    const pasted = text(form, 'pasted')
    const bytes = file instanceof File && file.size ? Buffer.from(await file.arrayBuffer()) : undefined
    const parsed = await readPeopleList({
      text: pasted,
      file: bytes ? { name: file instanceof File ? file.name : 'list.csv', bytes } : undefined,
    })
    const codes = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 0, limit: 200, where: { portal: { equals: portalId } } })
    const classes = await classesInPortal(payload, portalId)
    const preview = previewPeopleRows(parsed, {
      codes: (codes.docs as { code?: string }[]).map((row) => String(row.code || '')),
      classes: classes.map((row) => String(row.name || '')),
    })
    const token = `preview-${Date.now()}`
    ;(globalThis as typeof globalThis & { __heartsPeoplePreview?: Record<string, unknown> }).__heartsPeoplePreview = {
      ...(((globalThis as typeof globalThis & { __heartsPeoplePreview?: Record<string, unknown> }).__heartsPeoplePreview) || {}),
      [token]: { portalId, preview, at: now().toISOString() },
    }
    const url = new URL(next, 'http://local')
    url.searchParams.set('preview', token)
    return redirectTo(`${url.pathname}?${url.searchParams.toString()}`)
  }

  if (action === 'people-import-apply') {
    if (user.role === 'teacher') return redirectTo(next, 'A portal admin adds people from a list.')
    const token = text(form, 'preview')
    const stored = token ? ((globalThis as typeof globalThis & { __heartsPeoplePreview?: Record<string, { portalId: number; preview: ReturnType<typeof previewPeopleRows> }> }).__heartsPeoplePreview || {})[token] : null
    const file = form.get('file')
    const pasted = text(form, 'pasted')
    const bytes = file instanceof File && file.size ? Buffer.from(await file.arrayBuffer()) : undefined
    const codes = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 1, limit: 200, where: { portal: { equals: portalId } } })
    const classes = await classesInPortal(payload, portalId)
    const preview = stored?.preview || previewPeopleRows(
      await readPeopleList({
        text: pasted,
        file: bytes ? { name: file instanceof File ? file.name : 'list.csv', bytes } : undefined,
      }),
      {
        codes: (codes.docs as { code?: string }[]).map((row) => String(row.code || '')),
        classes: classes.map((row) => String(row.name || '')),
      },
    )
    if (preview.blocked.length) return redirectTo(next, 'Fix the marked rows first. Nothing was saved.')
    if (!preview.ready.length) return redirectTo(next, 'There is nobody to add.')
    markSkipAudit({ context: {} })
    const created: number[] = []
    const passwords: { name: string; email: string; password: string }[] = []
    for (const row of preview.ready) {
      const code = (codes.docs as { id: number; code?: string; packs?: unknown[]; role?: string }[]).find((item) => String(item.code || '').toUpperCase() === row.code)
      if (!code) return redirectTo(next, `The code ${row.code} is not in this portal.`)
      const packIds = ((code.packs || []) as unknown[]).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
      const courseList = packIds.length
        ? ((await payload.find({ collection: 'packs', overrideAccess: true, depth: 0, limit: 20, where: { id: { in: packIds } } })).docs as { courses?: unknown[] }[])
            .flatMap((pack) => (pack.courses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id)))
        : []
      const classRow = row.className ? classes.find((item) => String(item.name || '').toLowerCase() === row.className.toLowerCase()) : null
      const password = temporaryPassword()
      const made = await createImportedUser(payload, {
        portal: portalId,
        name: row.name,
        email: row.email,
        role: row.role,
        codeId: code.id,
        courseList,
        classId: classRow?.id,
        password,
      })
      if (!made.ok) return redirectTo(next, made.error)
      created.push(made.id)
      passwords.push({ name: row.name, email: row.email, password })
    }
    await audit(payload, 'people.import', {
      actor: user,
      actorRole: user.role,
      portal: portalId,
      detail: { count: created.length, ids: created },
    })
    const store = (globalThis as typeof globalThis & { __heartsImportPasswords?: Record<string, unknown> }).__heartsImportPasswords || {}
    const sheetToken = `import-${Date.now()}`
    store[sheetToken] = { passwords, at: now().toISOString() }
    ;(globalThis as typeof globalThis & { __heartsImportPasswords?: Record<string, unknown> }).__heartsImportPasswords = store
    const url = new URL(next, 'http://local')
    url.searchParams.set('imported', String(created.length))
    url.searchParams.set('sheet', sheetToken)
    return redirectTo(`${url.pathname}?${url.searchParams.toString()}`, undefined, `${created.length === 1 ? '1 person is' : `${created.length} people are`} in the portal.`)
  }

  if (action === 'people-bulk') {
    const ids = parseIdList(form.getAll('person'))
    const bulkAction = text(form, 'bulk') as BulkAction
    const plan = {
      action: bulkAction,
      ids,
      courseId: Number(text(form, 'course') || 0) || undefined,
      codeId: Number(text(form, 'code') || 0) || undefined,
      classId: Number(text(form, 'class') || 0) || undefined,
      start: text(form, 'start') || undefined,
      end: text(form, 'end') || undefined,
      weekdays: form.getAll('weekday').map((value) => Number(value)).filter((value) => Number.isInteger(value)),
      reason: text(form, 'reason') || undefined,
    }
    const problems = bulkProblems(plan)
    if (problems.length) return redirectTo(next, problems[0])
    const people = await peopleInScope(payload, portalId)
    const chosen = people.filter((person) => ids.includes(person.id) && staffMayTouchPerson(user, person))
    if (chosen.length !== ids.length) return redirectTo(next, 'One of those people is not in this portal.')
    const expected = bulkConfirmLine(chosen.length, bulkAction)
    if (text(form, 'confirm') !== 'yes') return redirectTo(next, 'Tick the confirmation. Nothing was changed.')

    markSkipAudit(session as never)

    if (bulkAction === 'give-course') {
      const courseId = plan.courseId!
      if (!(await visibleCourseIds(payload, user)).includes(courseId)) return redirectTo(next, 'That course is not in your portal.')
      for (const person of chosen) {
        const existing = ((person.extraCourses as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
        await payload.update({
          collection: 'users',
          id: person.id,
          overrideAccess: true,
          context: { skipAudit: true },
          data: { extraCourses: [...new Set([...existing, courseId])] } as never,
        })
      }
    }

    if (bulkAction === 'move-code') {
      const code = await findDoc(payload, 'access-codes', plan.codeId!)
      if (!code || idOf(code.portal) !== portalId) return redirectTo(next, 'That access code is not in this portal.')
      for (const person of chosen) {
        await payload.update({ collection: 'users', id: person.id, overrideAccess: true, context: { skipAudit: true }, data: { accessCode: code.id } as never })
      }
    }

    if (bulkAction === 'add-class') {
      const row = await classById(payload, plan.classId!)
      if (!row || idOf(row.portal) !== portalId) return redirectTo(next, 'That class is not in this portal.')
      await addPeopleToClass(payload, row.id, chosen.map((person) => person.id))
    }

    if (bulkAction === 'pause' || bulkAction === 'restore') {
      for (const person of chosen) {
        await payload.update({
          collection: 'users',
          id: person.id,
          overrideAccess: true,
          context: { skipAudit: true },
          data: { removed: bulkAction === 'pause' } as never,
        })
      }
    }

    if (bulkAction === 'assign-plan') {
      if (refuseFeature(await loadPortalById(payload, portalId), 'planner')) return redirectTo(next, FEATURE_UNAVAILABLE)
      const courseId = plan.courseId || Number(text(form, 'course'))
      if (!courseId) return redirectTo(next, 'Choose a course.')
      const adopted = new Set(await adoptedCourseIds(payload, portalId))
      const visible = new Set(await visibleCourseIds(payload, user))
      if (!visible.has(courseId) && !adopted.has(courseId)) return redirectTo(next, 'That course is not in your portal.')
      const lessons = await orderedLessons(payload, [courseId])
      if (!lessons.length) return redirectTo(next, 'There are no lessons to split yet.')
      let dates: string[]
      try {
        dates = studyDates(plan.start || '', plan.end || '', plan.weekdays?.length ? plan.weekdays : [1, 2, 3, 4, 5])
      } catch (error) {
        return redirectTo(next, error instanceof Error ? error.message : 'Those dates did not work.')
      }
      const minutes = minutesADay(text(form, 'minutes') || '20') || 20
      const slots = flattenSlots(splitEvenly(lessons.map((lesson) => ({ id: lesson.id, title: lesson.title || 'Sitting' })), dates))
      await payload.create({
        collection: 'schedules',
        overrideAccess: true,
        data: {
          name: text(form, 'planName') || `Class plan ${now().toISOString().slice(0, 10)}`,
          owner: user.id,
          learners: chosen.map((person) => person.id),
          targetType: 'course',
          course: courseId,
          startDate: plan.start,
          endDate: plan.end,
          weekdays: plan.weekdays?.length ? plan.weekdays : [1, 2, 3, 4, 5],
          slots,
          minutesPerDay: minutes,
          portal: portalId,
        } as never,
      })
      for (const person of chosen) {
        await notify(payload, {
          user: person.id,
          portal: portalId,
          title: 'A study plan was made for you',
          body: `${plural(slots.length, 'sitting')} between ${plan.start} and ${plan.end}.`,
          href: `/p/${acting.portal.slug}/me/plan`,
        })
      }
    }

    if (bulkAction === 'email') {
      await audit(payload, 'people.bulk', {
        actor: user,
        actorRole: user.role,
        portal: portalId,
        reason: plan.reason,
        detail: { kind: 'email', count: chosen.length, ids: chosen.map((person) => person.id), sent: false },
      })
      return redirectTo(next, undefined, 'Email will go out once the mail transport is on. Nothing was sent today.')
    }

    await audit(payload, 'people.bulk', {
      actor: user,
      actorRole: user.role,
      portal: portalId,
      reason: plan.reason,
      detail: { kind: bulkAction, count: chosen.length, ids: chosen.map((person) => person.id) },
    })
    return redirectTo(next, undefined, expected.replace('This will ', 'Done: ').replace(/\.$/, '.'))
  }

  return redirectTo(next, 'That action is not known.')
}

export { assignJoinerToClass }
