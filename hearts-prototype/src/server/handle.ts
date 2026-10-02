import { NextResponse } from 'next/server'
import { dualExtract, type ClauseCard } from '@/lib/extractor'
import { harvestTranscript } from '@/lib/harvest'
import { idOf, portalIdOf } from '@/lib/ids'
import { extractWithFallback, llmStatus } from '@/lib/llm'
import { flattenSlots, splitEvenly, studyDates } from '@/lib/schedule'
import { setTestNow } from '@/lib/clock'
import { ingestYoutubeUrl } from '@/lib/youtube'
import { adoptedCourseIds, coursesInPacks, getSession, loadPortal, type SessionUser } from './context'

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const url = new URL(path, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

async function loginResponse(req: Request, email: string, password: string, next: string) {
  const { payload } = await getSession()
  try {
    const result = await payload.login({ collection: 'users', data: { email, password } })
    if (!result.token) return redirectTo(req, '/login', 'That email or password did not match.')
    const response = redirectTo(req, next)
    response.headers.append(
      'Set-Cookie',
      `${payload.config.cookiePrefix}-token=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`,
    )
    return response
  } catch {
    return redirectTo(req, '/login', 'That email or password did not match.')
  }
}

function roleFromCode(role: string): SessionUser['role'] {
  if (role === 'admin') return 'portal-admin'
  if (role === 'teacher') return 'teacher'
  return 'learner'
}

const MAX_UPLOAD = 200 * 1024 * 1024

function tooBig(file: File) {
  return file.size > MAX_UPLOAD
}

async function actingPortal(payload: Awaited<ReturnType<typeof getSession>>['payload'], user: SessionUser, form: FormData) {
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
  const found = await loadPortal(payload, slug)
  if (!found) return { error: 'That portal could not be found.' as const }
  return { portal: { id: found.id, slug: found.slug } }
}

async function courseOfLesson(payload: Awaited<ReturnType<typeof getSession>>['payload'], lessonId: number) {
  const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 })
  const courseId = idOf((lesson as { course?: unknown }).course)
  const course = courseId ? await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 }) : null
  return { lesson, course }
}

function libraryLocked(user: SessionUser, course: { origin?: string } | null) {
  return Boolean(course && course.origin === 'master' && user.role !== 'master')
}

async function clauseCards(payload: Awaited<ReturnType<typeof getSession>>['payload']): Promise<ClauseCard[]> {
  const found = await payload.find({ collection: 'clauses', overrideAccess: true, depth: 0, limit: 50, sort: 'number' })
  return found.docs.map((doc) => {
    const row = doc as { number?: number; fragment?: string; core?: string; teaching?: string }
    return {
      number: row.number || 0,
      fragment: row.fragment || '',
      core: row.core || '',
      teaching: row.teaching || '',
    }
  })
}

async function orderedLessons(payload: Awaited<ReturnType<typeof getSession>>['payload'], courseIds: number[]) {
  if (!courseIds.length) return []
  const units = await payload.find({
    collection: 'units',
    overrideAccess: true,
    depth: 0,
    limit: 400,
    where: { course: { in: courseIds } },
    sort: 'order',
  })
  const unitIds = units.docs.map((doc) => doc.id)
  if (!unitIds.length) return []
  const lessons = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 800,
    where: { unit: { in: unitIds } },
    sort: 'order',
  })
  const unitOrder = new Map(units.docs.map((doc, index) => [doc.id, index]))
  return [...lessons.docs].sort((a, b) => {
    const left = unitOrder.get(idOf((a as { unit?: unknown }).unit) || 0) ?? 0
    const right = unitOrder.get(idOf((b as { unit?: unknown }).unit) || 0) ?? 0
    if (left !== right) return left - right
    return ((a as { order?: number }).order || 0) - ((b as { order?: number }).order || 0)
  }) as { id: number; title?: string; course?: unknown }[]
}

export async function handlePost(req: Request) {
  const form = await req.formData()
  const action = text(form, 'action')
  const { payload, user } = await getSession()

  if (action === 'login') {
    const next = text(form, 'next') || '/'
    return loginResponse(req, text(form, 'email').toLowerCase(), text(form, 'password'), next)
  }

  if (action === 'logout') {
    const response = redirectTo(req, '/')
    response.headers.append(
      'Set-Cookie',
      `${payload.config.cookiePrefix}-token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`,
    )
    return response
  }

  if (action === 'clock') {
    try {
      const iso = text(form, 'iso')
      setTestNow(iso || null)
      return redirectTo(req, text(form, 'next') || '/', undefined, 'Clock moved.')
    } catch (error) {
      return redirectTo(req, text(form, 'next') || '/', error instanceof Error ? error.message : 'Clock refused.')
    }
  }

  if (action === 'join') {
    const codeValue = text(form, 'code')
    const name = text(form, 'name')
    const email = text(form, 'email').toLowerCase()
    const password = text(form, 'password')
    if (!name || !email || !password) return redirectTo(req, `/join?code=${encodeURIComponent(codeValue)}`, 'Name, email and a password are all needed.')
    if (password.length < 8) return redirectTo(req, `/join?code=${encodeURIComponent(codeValue)}`, 'Use at least 8 characters for the password.')
    const found = await payload.find({
      collection: 'access-codes',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { code: { equals: codeValue } },
    })
    const access = found.docs[0] as { id: number; role?: string; portal?: unknown; packs?: unknown[] } | undefined
    if (!access) return redirectTo(req, '/join', 'That access code was not recognised.')
    const portal = idOf(access.portal)
    if (!portal) return redirectTo(req, '/join', 'That access code is not attached to a portal.')
    const portalDoc = await payload.findByID({ collection: 'portals', id: portal, overrideAccess: true, depth: 0 })
    if ((portalDoc as { closed?: boolean }).closed) return redirectTo(req, '/join', 'This portal is deactivated. Ask the master desk to open it again.')
    const existing = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: email } } })
    if (existing.docs.length) return redirectTo(req, `/login?next=/p/${(portalDoc as { slug?: string }).slug || ''}`, 'That email already has an account. Sign in instead.')
    const slug = (portalDoc as { slug?: string }).slug || ''
    const packIds = (access.packs || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    const courseList = await coursesInPacks(payload, packIds)
    const codeRole = access.role || 'learner'
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email,
        password,
        name,
        role: roleFromCode(codeRole),
        audience: codeRole === 'parent' ? 'parent' : codeRole,
        accessCode: access.id,
        courseList,
        tenants: [{ tenant: portal }],
        onboarded: codeRole !== 'learner' && codeRole !== 'parent',
      },
    })
    const next = codeRole === 'learner' || codeRole === 'parent' ? `/p/${slug}/about` : `/p/${slug}/admin`
    return loginResponse(req, email, password, next)
  }

  if (!user) return redirectTo(req, '/login', 'Please sign in first.')

  if (action === 'create-portal') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can open a portal.')
    const name = text(form, 'name')
    const slug = text(form, 'slug').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
    if (!name || !slug) return redirectTo(req, '/master', 'A portal needs a name and a short address.')
    const clash = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: slug } } })
    if (clash.docs.length) return redirectTo(req, '/master', 'That address is already in use.')
    await payload.create({
      collection: 'portals',
      overrideAccess: true,
      data: {
        name,
        slug,
        kind: text(form, 'kind') || 'mosque',
        welcome: text(form, 'welcome') || `${name} keeps a gentle room for whoever is sent.`,
        colour: text(form, 'colour') || '#1f4d3a',
        watchHistoryOptIn: false,
      },
    })
    return redirectTo(req, '/master', undefined, `${name} is open.`)
  }

  if (action === 'create-pack') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot make a course pack.')
    const title = text(form, 'title')
    if (!title) return redirectTo(req, text(form, 'next') || '/master', 'Give the course pack a name.')
    const wantsMasterPack = text(form, 'owner') === 'master' || (user.role === 'master' && !text(form, 'portalSlug'))
    let portalId: number | undefined
    if (!wantsMasterPack) {
      const acting = await actingPortal(payload, user, form)
      if ('error' in acting) return redirectTo(req, text(form, 'next') || '/master', acting.error)
      portalId = acting.portal.id
    }
    await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: {
        title,
        summary: text(form, 'summary'),
        owner: portalId ? 'portal' : 'master',
        portal: portalId,
        courses: [],
      },
    })
    return redirectTo(req, text(form, 'next') || '/master', undefined, 'Course pack saved.')
  }

  if (action === 'create-code') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot make an access code.')
    const code = text(form, 'code').toUpperCase().replace(/\s+/g, '')
    const role = text(form, 'role')
    const packId = Number(text(form, 'pack'))
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/master', acting.error)
    if (!code || !role || !packId) return redirectTo(req, text(form, 'next') || '/master', 'An access code needs a code, a role and a course pack.')
    if ((role === 'learner' || role === 'parent') && !text(form, 'linkedTeacherCode')) {
      return redirectTo(req, text(form, 'next') || '/master', 'A learner code needs a teacher code, so someone can see their progress.')
    }
    if (role === 'parent') {
      const packed = await coursesInPacks(payload, [packId])
      if (packed.length !== 1) return redirectTo(req, text(form, 'next') || '/master', 'A parent code carries exactly one course.')
    }
    const clash = await payload.find({ collection: 'access-codes', overrideAccess: true, limit: 1, where: { code: { equals: code } } })
    if (clash.docs.length) return redirectTo(req, text(form, 'next') || '/master', 'That access code is already taken.')
    const linked = text(form, 'linkedTeacherCode')
    const required = form.getAll('requiredCourse').map((value) => Number(value)).filter(Boolean)
    await payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: {
        code,
        role,
        packs: [packId],
        portal: acting.portal.id,
        linkedTeacherCode: linked ? Number(linked) : undefined,
        parentMentorCode: role === 'parent' && linked ? Number(linked) : undefined,
        requiredCourses: required,
      },
    })
    return redirectTo(req, text(form, 'next') || '/master', undefined, `Access code ${code} is ready.`)
  }

  if (action === 'create-course') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot build a course.')
    const title = text(form, 'title')
    const next = text(form, 'next') || '/master'
    if (!title) return redirectTo(req, next, 'Give the course a name.')
    const origin = text(form, 'origin') === 'local' ? 'local' : 'master'
    let portal: number | null = null
    if (origin === 'local') {
      const acting = await actingPortal(payload, user, form)
      if ('error' in acting) return redirectTo(req, next, acting.error)
      portal = acting.portal.id
    }
    const course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: {
        title,
        summary: text(form, 'summary'),
        speaker: text(form, 'speaker'),
        origin,
        portal: portal || undefined,
        importable: origin === 'master',
        visibility: text(form, 'visibility') || 'published',
      },
    })
    const unit = await payload.create({
      collection: 'units',
      overrideAccess: true,
      data: { title: text(form, 'unit') || 'Unit 1', course: course.id, order: 1 },
    })
    const lessonTitle = text(form, 'lesson') || title
    await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title: lessonTitle,
        unit: unit.id,
        course: course.id,
        portal: portal || undefined,
        master: origin === 'master',
        order: 1,
        speaker: text(form, 'speaker'),
        transcriptSource: 'none',
        durationSeconds: Number(text(form, 'duration') || 0) || undefined,
      },
    })
    const packId = Number(text(form, 'pack') || 0)
    if (packId) {
      const pack = await payload.findByID({ collection: 'packs', id: packId, overrideAccess: true, depth: 0 })
      const existing = ((pack as { courses?: unknown[] }).courses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
      await payload.update({
        collection: 'packs',
        id: packId,
        overrideAccess: true,
        data: { courses: [...new Set([...existing, course.id])] },
      })
    }
    return redirectTo(req, next, undefined, 'Course saved.')
  }

  if (action === 'add-lesson') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot add a lesson.')
    const courseId = Number(text(form, 'course'))
    const title = text(form, 'title')
    if (!courseId || !title) return redirectTo(req, text(form, 'next') || '/', 'A lesson needs a name.')
    const courseDoc = await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 })
    if (libraryLocked(user, courseDoc as { origin?: string })) {
      return redirectTo(req, text(form, 'next') || '/', 'This course is linked from the library. You can view it or remove the link. You cannot edit the original.')
    }
    const units = await payload.find({ collection: 'units', overrideAccess: true, limit: 1, where: { course: { equals: courseId } }, sort: 'order' })
    const unit = units.docs[0]
    if (!unit) return redirectTo(req, text(form, 'next') || '/', 'That course has no unit yet.')
    const course = await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 })
    const count = await payload.count({ collection: 'lessons', overrideAccess: true, where: { course: { equals: courseId } } })
    await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title,
        unit: unit.id,
        course: courseId,
        portal: idOf((course as { portal?: unknown }).portal) || undefined,
        master: (course as { origin?: string }).origin === 'master',
        order: count.totalDocs + 1,
        speaker: (course as { speaker?: string }).speaker,
        transcriptSource: 'none',
      },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Lesson added.')
  }

  if (action === 'adopt') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot adopt into this portal.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    const kind = text(form, 'kind') === 'course' ? 'course' : 'pack'
    if (kind === 'course') {
      const course = await payload.findByID({ collection: 'courses', id: Number(text(form, 'course')), overrideAccess: true, depth: 0 })
      if (!(course as { importable?: boolean }).importable && (course as { origin?: string }).origin === 'master') {
        return redirectTo(req, text(form, 'next') || '/', 'That course is not marked importable.')
      }
    }
    await payload.create({
      collection: 'adoptions',
      overrideAccess: true,
      data: {
        kind,
        portal,
        pack: kind === 'pack' ? Number(text(form, 'pack')) : undefined,
        course: kind === 'course' ? Number(text(form, 'course')) : undefined,
      },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, kind === 'pack' ? 'Pack adopted. It stays linked to the master.' : 'Course adopted. It stays linked to the master.')
  }

  if (action === 'split-pack') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot split a pack.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    const title = text(form, 'title')
    const courseIds = form.getAll('course').map((value) => Number(value)).filter(Boolean)
    if (!title || !courseIds.length) return redirectTo(req, text(form, 'next') || '/', 'Name the new pack and tick at least one course.')
    const pack = await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: { title, owner: 'portal', portal, courses: courseIds, summary: 'Split from a master pack.' },
    })
    await payload.create({
      collection: 'adoptions',
      overrideAccess: true,
      data: { kind: 'pack', portal, pack: pack.id },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Pack split. Only the courses you ticked came across.')
  }

  if (action === 'ingest') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot ingest a film.')
    const lessonId = Number(text(form, 'lesson'))
    const next = text(form, 'next') || '/'
    const owned = await courseOfLesson(payload, lessonId)
    if (libraryLocked(user, owned.course as { origin?: string } | null)) {
      return redirectTo(req, next, 'This course is linked from the library. You can view it or remove the link. You cannot edit the original.')
    }
    const url = text(form, 'url')
    const result = await ingestYoutubeUrl(url)
    if (!result.meta && /^https?:\/\//i.test(url)) {
      await payload.update({
        collection: 'lessons',
        id: lessonId,
        overrideAccess: true,
        data: { sourceUrl: url, transcriptNote: 'Share link saved. The server did not download the file. Upload a transcript to extract.' },
      })
      return redirectTo(req, next, 'The link is saved. This server did not fetch the file. Upload a transcript, or paste a YouTube link.')
    }
    if (!result.meta && result.error) return redirectTo(req, next, result.error)
    if (result.meta) {
      await payload.update({
        collection: 'lessons',
        id: lessonId,
        overrideAccess: true,
        data: {
          youtubeId: result.meta.id,
          youtubeUrl: `https://www.youtube.com/watch?v=${result.meta.id}`,
          title: text(form, 'keepTitle') ? undefined : result.meta.title,
          speaker: result.meta.author,
          ...(result.ok
            ? { transcript: result.transcript, transcriptSource: 'youtube', transcriptNote: 'Captions fetched from YouTube.' }
            : { transcriptNote: result.error }),
        },
      })
    }
    if (!result.ok) return redirectTo(req, next, result.error)
    return redirectTo(req, next, undefined, 'YouTube film and captions saved.')
  }

  if (action === 'upload-transcript') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot upload a transcript.')
    const file = form.get('file')
    const next = text(form, 'next') || '/'
    if (!(file instanceof File) || file.size === 0) return redirectTo(req, next, 'Choose a .vtt, .srt or .txt transcript.')
    if (tooBig(file)) return redirectTo(req, next, 'That file is over 200 MB. Compress it, or upload a transcript instead.')
    const owned = await courseOfLesson(payload, Number(text(form, 'lesson')))
    if (libraryLocked(user, owned.course as { origin?: string } | null)) {
      return redirectTo(req, next, 'This course is linked from the library. You can view it or remove the link. You cannot edit the original.')
    }
    const name = file.name.toLowerCase()
    if (!name.endsWith('.vtt') && !name.endsWith('.srt') && !name.endsWith('.txt') && !name.endsWith('.md')) {
      return redirectTo(req, next, 'Use a .vtt, .srt or .txt file.')
    }
    const transcript = await file.text()
    if (!transcript.trim()) return redirectTo(req, next, 'That file was empty.')
    await payload.update({
      collection: 'lessons',
      id: Number(text(form, 'lesson')),
      overrideAccess: true,
      data: {
        transcript,
        transcriptSource: 'upload',
        transcriptNote: `Uploaded from ${file.name}.`,
      },
    })
    return redirectTo(req, next, undefined, 'Transcript uploaded.')
  }

  if (action === 'extract') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot run the extractor.')
    const lessonId = Number(text(form, 'lesson'))
    const next = text(form, 'next') || '/'
    const owned = await courseOfLesson(payload, lessonId)
    if (libraryLocked(user, owned.course as { origin?: string } | null)) {
      return redirectTo(req, next, 'This course is linked from the library. You can view it or remove the link. You cannot edit the original.')
    }
    const lesson = owned.lesson
    const transcript = (lesson as { transcript?: string }).transcript || ''
    if (!transcript.trim()) return redirectTo(req, next, 'This lesson has no transcript yet. Paste a YouTube link that has captions, or upload a .vtt, .srt or .txt file.')
    const result = await extractWithFallback(transcript, await clauseCards(payload))
    const old = await payload.find({ collection: 'cuts', overrideAccess: true, limit: 200, where: { lesson: { equals: lessonId } } })
    for (const cut of old.docs) await payload.delete({ collection: 'cuts', id: cut.id, overrideAccess: true })
    const oldLadder = await payload.find({ collection: 'ladder-items', overrideAccess: true, limit: 200, where: { lesson: { equals: lessonId } } })
    for (const item of oldLadder.docs) await payload.delete({ collection: 'ladder-items', id: item.id, overrideAccess: true })
    const clauseByNumber = new Map((await clauseCards(payload)).map((card) => [card.number, card]))
    const clauses = await payload.find({ collection: 'clauses', overrideAccess: true, limit: 50 })
    const clauseId = new Map(clauses.docs.map((doc) => [(doc as { number?: number }).number, doc.id]))
    for (const cut of result.cuts) {
      const saved = await payload.create({
        collection: 'cuts',
        overrideAccess: true,
        data: {
          lesson: lessonId,
          course: idOf((lesson as { course?: unknown }).course) || undefined,
          status: 'draft',
          start: Math.round(cut.start),
          end: Math.round(cut.end),
          timestamp: cut.timestamp,
          hook: cut.hook,
          turn: cut.turn,
          land: cut.land,
          fullContext: cut.fullContext,
          theme: cut.theme,
          device: cut.device,
          whyItAllures: cut.whyItAllures,
          bestClause: cut.bestClause,
          clauseFragment: cut.clauseFragment,
          hangStrength: cut.hangStrength,
          whyHang: cut.whyHang,
          seatHint: cut.seatHint,
          stage2Form: cut.stage2Form,
          currencyNote: cut.currencyNote,
          quoteConfidence: cut.quoteConfidence,
          exemplarAffinity: cut.exemplarAffinity,
          kind: cut.kind,
          engine: result.engine,
        },
      })
      if (cut.bestClause && clauseId.get(cut.bestClause)) {
        await payload.create({
          collection: 'tags',
          overrideAccess: true,
          data: {
            item: { relationTo: 'cuts', value: saved.id },
            clause: clauseId.get(cut.bestClause),
            state: 'suggested',
            note: cut.whyHang,
          },
        })
      }
      void clauseByNumber
    }
    for (const item of result.ladder) {
      await payload.create({
        collection: 'ladder-items',
        overrideAccess: true,
        data: {
          lesson: lessonId,
          kind: item.kind,
          start: Math.round(item.start),
          end: Math.round(item.end),
          quote: item.quote,
        },
      })
    }
    return redirectTo(req, next, undefined, `${result.cuts.length} cuts drafted (${llmStatus()}).`)
  }

  if (action === 'cut-status') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot review cuts.')
    const cut = await payload.findByID({ collection: 'cuts', id: Number(text(form, 'cut')), overrideAccess: true, depth: 0 })
    const courseId = idOf((cut as { course?: unknown }).course)
    const course = courseId ? await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 }) : null
    if (libraryLocked(user, course as { origin?: string } | null)) {
      return redirectTo(req, text(form, 'next') || '/', 'This course is linked from the library. You can view it or remove the link. You cannot edit the original.')
    }
    await payload.update({
      collection: 'cuts',
      id: Number(text(form, 'cut')),
      overrideAccess: true,
      data: {
        status: text(form, 'status'),
        hook: text(form, 'hook') || undefined,
        turn: text(form, 'turn') || undefined,
        land: text(form, 'land') || undefined,
      },
    })
    if (text(form, 'confirm') === 'yes') {
      const cutId = Number(text(form, 'cut'))
      const tags = await payload.find({
        collection: 'tags',
        overrideAccess: true,
        limit: 20,
        where: { and: [{ 'item.value': { equals: cutId } }, { 'item.relationTo': { equals: 'cuts' } }] },
      })
      for (const tag of tags.docs) {
        await payload.update({ collection: 'tags', id: tag.id, overrideAccess: true, data: { state: 'confirmed' } })
      }
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Cut updated.')
  }

  if (action === 'create-point') {
    if (user.role === 'learner') return redirectTo(req, '/', 'You cannot place a question.')
    const prompt = text(form, 'prompt')
    const next = text(form, 'next') || '/'
    if (!prompt) return redirectTo(req, next, 'Write the question first.')
    const lessonId = Number(text(form, 'lesson'))
    const owned = await courseOfLesson(payload, lessonId)
    const course = owned.course as { id: number; origin?: string; portal?: unknown } | null
    if (user.role !== 'master') {
      const portal = portalIdOf(user)
      const localHere = course?.origin === 'local' && idOf(course.portal) === portal
      const adopted = portal ? await adoptedCourseIds(payload, portal) : []
      const libraryHere = course?.origin === 'master' && adopted.includes(course.id)
      if (!localHere && !libraryHere) return redirectTo(req, next, 'That film is not in your portal.')
    }
    const audience = text(form, 'audience') || 'everyone'
    const selected = form.getAll('learner').map((value) => Number(value)).filter(Boolean)
    if (audience === 'selected' && !selected.length) return redirectTo(req, next, 'Choose at least one learner, or keep the question to yourself.')
    const options = text(form, 'options')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const onLibrary = course?.origin === 'master' && user.role !== 'master'
    await payload.create({
      collection: 'engagement-points',
      overrideAccess: true,
      data: {
        lesson: lessonId,
        second: Number(text(form, 'second') || 0),
        kind: text(form, 'kind') || 'reflection',
        prompt,
        options: options.length ? options : undefined,
        timing: onLibrary ? 'immediate' : text(form, 'timing') === 'future' ? 'future' : 'immediate',
        delayAmount: onLibrary ? 0 : Number(text(form, 'delayAmount') || 0),
        delayUnit: text(form, 'delayUnit') || 'week',
        contingent: onLibrary ? undefined : text(form, 'contingent') ? Number(text(form, 'contingent')) : undefined,
        link: text(form, 'link') || undefined,
        timeLimit: text(form, 'timeLimit') ? Number(text(form, 'timeLimit')) : undefined,
        author: user.id,
        audience: audience === 'self' || audience === 'selected' ? audience : 'everyone',
        audienceUsers: audience === 'selected' ? selected : undefined,
      },
    })
    return redirectTo(req, next, undefined, 'Question placed on the timeline.')
  }

  if (action === 'answer') {
    const pointId = Number(text(form, 'point'))
    const point = await payload.findByID({ collection: 'engagement-points', id: pointId, overrideAccess: true, depth: 0 })
    const lessonId = idOf((point as { lesson?: unknown }).lesson)
    const portal = portalIdOf(user)
    if (!portal) return redirectTo(req, '/', 'Your account is not in a portal.')
    const body = text(form, 'body')
    const choice = text(form, 'choice')
    const image = form.get('image')
    const video = form.get('video')
    const audioFile = form.get('audio')
    const hasVideo = video instanceof File && video.size > 0
    const hasAudio = audioFile instanceof File && audioFile.size > 0
    if (!body && !choice && !(image instanceof File && image.size > 0) && !hasVideo && !hasAudio) {
      return redirectTo(req, text(form, 'next') || '/', 'Write a few words, or add an image, a sound, or a video.')
    }
    for (const file of [image, video, audioFile]) {
      if (file instanceof File && tooBig(file)) return redirectTo(req, text(form, 'next') || '/', 'That file is over 200 MB.')
    }
    let imageId: number | undefined
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith('image/')) return redirectTo(req, text(form, 'next') || '/', 'That file needs to be an image.')
      const media = await payload.create({
        collection: 'media',
        overrideAccess: true,
        data: { alt: image.name },
        file: {
          data: Buffer.from(await image.arrayBuffer()),
          mimetype: image.type,
          name: image.name,
          size: image.size,
        },
      })
      imageId = media.id
    }
    const audio = audioFile
    let audioId: number | undefined
    if (audio instanceof File && audio.size > 0) {
      const media = await payload.create({
        collection: 'media',
        overrideAccess: true,
        data: { alt: audio.name },
        file: { data: Buffer.from(await audio.arrayBuffer()), mimetype: audio.type || 'audio/webm', name: audio.name, size: audio.size },
      })
      audioId = media.id
    }
    let videoId: number | undefined
    if (video instanceof File && video.size > 0) {
      const media = await payload.create({
        collection: 'media',
        overrideAccess: true,
        data: { alt: video.name },
        file: { data: Buffer.from(await video.arrayBuffer()), mimetype: video.type || 'video/mp4', name: video.name, size: video.size },
      })
      videoId = media.id
    }
    const keepPrivate = form.get('keepPrivate') === 'on'
    const shareWithTeacher = form.get('shareWithTeacher') === 'on'
    const answer = await payload.create({
      collection: 'answers',
      overrideAccess: true,
      data: {
        point: pointId,
        user: user.id,
        lesson: lessonId || undefined,
        body,
        choice,
        image: imageId,
        audio: audioId,
        video: videoId,
        keepPrivate,
        shareWithTeacher,
        portal,
      },
    })
    const lesson = lessonId ? await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 }) : null
    await payload.create({
      collection: 'workbook-entries',
      overrideAccess: true,
      data: {
        user: user.id,
        answer: answer.id,
        lesson: lessonId || undefined,
        course: lesson ? idOf((lesson as { course?: unknown }).course) || undefined : undefined,
        body: body || choice,
        image: imageId,
        consent: shareWithTeacher,
        portal,
      },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Saved. It is in your workbook.')
  }

  if (action === 'placing') {
    const portal = portalIdOf(user)
    const questions = await payload.find({ collection: 'placing-questions', overrideAccess: true, limit: 20, sort: 'order' })
    const choices: string[] = []
    for (const question of questions.docs) {
      const choice = text(form, `q-${question.id}`)
      if (!choice) return redirectTo(req, text(form, 'next') || '/', 'Sit with each question. One is still open.')
      choices.push(choice)
      await payload.create({
        collection: 'placing-answers',
        overrideAccess: true,
        data: { user: user.id, question: question.id, choice, portal: portal || undefined },
      })
    }
    const blob = choices.join(' ').toLowerCase()
    let starting = 13
    if (blob.includes('prayer')) starting = 15
    else if (blob.includes('allah') || blob.includes('lord')) starting = 22
    else if (blob.includes('prophet')) starting = 3
    else if (blob.includes('people') || blob.includes('treat')) starting = 4
    else if (blob.includes('flux') || blob.includes('tender')) starting = 2
    await payload.update({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      data: { onboarded: true, startingClause: starting },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'We have a gentle place to begin.')
  }

  if (action === 'schedule') {
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    const name = text(form, 'name') || 'My study days'
    const targetType = text(form, 'targetType') === 'pack' ? 'pack' : 'course'
    let courseIds: number[] = []
    if (targetType === 'pack') {
      const pack = await payload.findByID({ collection: 'packs', id: Number(text(form, 'pack')), overrideAccess: true, depth: 0 })
      courseIds = ((pack as { courses?: unknown[] }).courses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    } else {
      courseIds = [Number(text(form, 'course'))]
    }
    const lessons = await orderedLessons(payload, courseIds)
    if (!lessons.length) return redirectTo(req, text(form, 'next') || '/', 'There are no lessons to split yet.')
    let dates: string[]
    try {
      dates = studyDates(text(form, 'start'), text(form, 'end'), form.getAll('weekday').map((value) => Number(value)))
    } catch (error) {
      return redirectTo(req, text(form, 'next') || '/', error instanceof Error ? error.message : 'Those dates did not work.')
    }
    const slots = flattenSlots(splitEvenly(lessons.map((lesson) => ({ id: lesson.id, title: lesson.title || 'Sitting' })), dates))
    const learnerIds = form.getAll('learner').map((value) => Number(value)).filter(Boolean)
    await payload.create({
      collection: 'schedules',
      overrideAccess: true,
      data: {
        name,
        owner: user.id,
        learners: learnerIds.length ? learnerIds : [user.id],
        targetType,
        course: targetType === 'course' ? courseIds[0] : undefined,
        pack: targetType === 'pack' ? Number(text(form, 'pack')) : undefined,
        startDate: text(form, 'start'),
        endDate: text(form, 'end'),
        weekdays: form.getAll('weekday').map((value) => Number(value)),
        slots,
        portal,
      },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'The plan is spread across the days you chose. It is a guide, not a lock.')
  }

  if (action === 'rsvp' || action === 'checkin') {
    const portal = portalIdOf(user)
    const eventId = Number(text(form, 'event'))
    if (action === 'rsvp') {
      const existing = await payload.find({
        collection: 'rsvps',
        overrideAccess: true,
        limit: 1,
        where: { and: [{ event: { equals: eventId } }, { user: { equals: user.id } }] },
      })
      if (!existing.docs.length) {
        await payload.create({ collection: 'rsvps', overrideAccess: true, data: { event: eventId, user: user.id, status: 'going', portal: portal || undefined } })
      }
      return redirectTo(req, text(form, 'next') || '/', undefined, 'You are down for the night.')
    }
    const override = form.get('override') === 'on'
    if (override && user.role === 'learner') return redirectTo(req, text(form, 'next') || '/', 'Only a teacher or admin can override the soft ticket.')
    await payload.create({
      collection: 'checkins',
      overrideAccess: true,
      data: { event: eventId, user: override ? Number(text(form, 'learner') || user.id) : user.id, override, portal: portal || undefined },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, override ? 'Checked in with an override.' : 'Checked in. Welcome.')
  }

  if (action === 'board') {
    const body = text(form, 'body')
    const portal = portalIdOf(user)
    if (!body) return redirectTo(req, text(form, 'next') || '/', 'Write a note for the board.')
    await payload.create({ collection: 'messages', overrideAccess: true, data: { body, author: user.id, portal: portal || undefined } })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Posted to the board.')
  }

  if (action === 'reply') {
    if (user.role === 'learner') return redirectTo(req, '/', 'Learners do not reply on this desk.')
    const entryId = Number(text(form, 'entry'))
    const reply = text(form, 'reply')
    if (!reply) return redirectTo(req, text(form, 'next') || '/', 'Write a reply first.')
    const entry = await payload.findByID({ collection: 'workbook-entries', id: entryId, overrideAccess: true, depth: 0 })
    if (user.role !== 'master' && idOf((entry as { portal?: unknown }).portal) !== portalIdOf(user)) {
      return redirectTo(req, '/', 'That workbook is not in your portal.')
    }
    await payload.update({
      collection: 'workbook-entries',
      id: entryId,
      overrideAccess: true,
      data: { teacherReply: reply, repliedAt: new Date().toISOString() },
    })
    const learnerId = idOf((entry as { user?: unknown }).user)
    if (learnerId) {
      const portal = idOf((entry as { portal?: unknown }).portal)
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: {
          user: learnerId,
          portal: portal || undefined,
          title: 'Your teacher replied',
          body: reply,
          href: text(form, 'href') || '/',
          channel: 'in-app',
        },
      })
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: {
          user: learnerId,
          portal: portal || undefined,
          title: 'Email not sent',
          body: 'Email is stubbed in this prototype. The reply is waiting in the bell.',
          href: text(form, 'href') || '/',
          channel: 'email-stub',
        },
      })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Reply saved.')
  }

  if (action === 'complete') {
    const lessonId = Number(text(form, 'lesson'))
    const portal = portalIdOf(user)
    const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 })
    const duration = Number((lesson as { durationSeconds?: number }).durationSeconds || 0)
    const seconds = Number(text(form, 'seconds') || 0)
    const ended = text(form, 'ended') === 'yes'
    const ratio = duration > 0 ? seconds / duration : seconds > 0 ? 1 : 0
    if (!ended && ratio < 0.8) {
      return redirectTo(req, text(form, 'next') || '/', 'A sitting counts once most of the film has played, or when it ends.')
    }
    const percent = Math.min(100, Math.round((ended && ratio < 0.8 ? 100 : ratio) * 100))
    let onTime = false
    if (portal) {
      const plans = await payload.find({
        collection: 'schedules',
        overrideAccess: true,
        depth: 0,
        limit: 20,
        where: { and: [{ portal: { equals: portal } }, { learners: { contains: user.id } }] },
      })
      const today = new Date().toISOString().slice(0, 10)
      for (const plan of plans.docs as { slots?: { date?: string; lessonId?: number }[] }[]) {
        const slot = (plan.slots || []).find((row) => row.lessonId === lessonId)
        if (slot?.date && today <= slot.date) onTime = true
      }
    }
    const existing = await payload.find({
      collection: 'completions',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] },
    })
    if (!existing.docs.length) {
      await payload.create({
        collection: 'completions',
        overrideAccess: true,
        data: { user: user.id, lesson: lessonId, portal: portal || undefined, percent, onTime },
      })
    }
    const fullUser = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })
    if ((fullUser as { shareWatch?: boolean }).shareWatch) {
      await payload.create({
        collection: 'watch-sessions',
        overrideAccess: true,
        data: { user: user.id, lesson: lessonId, seconds: Number(text(form, 'seconds') || 0), portal },
      })
    }
    const transcript = (lesson as { transcript?: string }).transcript || ''
    if (transcript) {
      const already = await payload.find({
        collection: 'harvest-entries',
        overrideAccess: true,
        limit: 1,
        where: { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] },
      })
      if (!already.docs.length) {
        for (const hit of harvestTranscript(transcript)) {
          await payload.create({
            collection: 'harvest-entries',
            overrideAccess: true,
            data: { user: user.id, lesson: lessonId, portal: portal || undefined, ...hit },
          })
        }
      }
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Marked as sat with. Your Grow page can see it.')
  }

  if (action === 'seat') {
    const seatId = Number(text(form, 'seat'))
    const portal = portalIdOf(user)
    const existing = await payload.find({
      collection: 'seat-visits',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ user: { equals: user.id } }, { seat: { equals: seatId } }] },
    })
    if (!existing.docs.length) {
      await payload.create({ collection: 'seat-visits', overrideAccess: true, data: { user: user.id, seat: seatId, returned: false, portal: portal || undefined } })
    } else if (text(form, 'returned') === 'yes') {
      await payload.update({ collection: 'seat-visits', id: existing.docs[0].id, overrideAccess: true, data: { returned: true } })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Seat noted.')
  }

  if (action === 'ritual') {
    await payload.create({
      collection: 'rituals',
      overrideAccess: true,
      data: { user: user.id, note: text(form, 'note') || 'I held back a harsh word.', portal: portalIdOf(user) || undefined },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'That small act is banked. It is not a streak.')
  }

  if (action === 'settings') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'Only a portal admin can change this.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    const data: Record<string, unknown> = {}
    for (const key of ['welcome', 'colour', 'organisationName', 'description', 'logoUrl', 'calendarUrl', 'notificationEmails', 'learnerWelcomeUrl', 'learnerIntroUrl', 'teacherWelcomeUrl', 'teacherIntroUrl', 'learnerLabel', 'teacherLabel']) {
      if (form.has(key)) data[key] = text(form, key)
    }
    if (form.has('theme')) data.theme = text(form, 'theme') === 'dark' ? 'dark' : 'light'
    if (form.get('settingsForm') === 'yes') {
      data.showOthersAnswers = form.get('showOthersAnswers') === 'on'
      data.watchHistoryOptIn = form.get('watchHistoryOptIn') === 'on'
    }
    if (form.get('wizardDone') === 'on') data.wizardDone = true
    await payload.update({
      collection: 'portals',
      id: portal,
      overrideAccess: true,
      data,
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Portal settings saved.')
  }

  if (action === 'placing-question') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot edit the questions.')
    const prompt = text(form, 'prompt')
    const options = text(form, 'options').split('\n').map((line) => line.trim()).filter(Boolean)
    if (!prompt || options.length < 2) return redirectTo(req, text(form, 'next') || '/', 'A question needs words and at least two answers.')
    await payload.create({
      collection: 'placing-questions',
      overrideAccess: true,
      data: {
        prompt,
        why: text(form, 'why'),
        options,
        order: Number(text(form, 'order') || 10),
        portal: text(form, 'portal') ? Number(text(form, 'portal')) : undefined,
      },
    })
    return redirectTo(req, text(form, 'next') || '/master', undefined, 'Question saved.')
  }

  if (action === 'create-event') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot open a night.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    if (!text(form, 'title')) return redirectTo(req, text(form, 'next') || '/', 'Give the night a name.')
    await payload.create({
      collection: 'events',
      overrideAccess: true,
      data: {
        title: text(form, 'title'),
        place: text(form, 'place'),
        note: text(form, 'note'),
        startsAt: text(form, 'startsAt') || undefined,
        portal,
      },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Night saved.')
  }

  if (action === 'read-notes') {
    const notes = await payload.find({
      collection: 'notifications',
      overrideAccess: true,
      limit: 50,
      where: { user: { equals: user.id } },
    })
    for (const note of notes.docs) {
      await payload.update({ collection: 'notifications', id: note.id, overrideAccess: true, data: { read: true } })
    }
    return redirectTo(req, text(form, 'next') || '/')
  }

  if (action === 'deactivate') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can deactivate a portal.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/master', acting.error)
    const closed = text(form, 'closed') !== 'no'
    await payload.update({ collection: 'portals', id: acting.portal.id, overrideAccess: true, data: { closed } })
    return redirectTo(req, text(form, 'next') || '/master', undefined, closed ? 'Portal deactivated.' : 'Portal is active again.')
  }

  if (action === 'remove-adoption') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot remove a link.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const adoption = await payload.findByID({ collection: 'adoptions', id: Number(text(form, 'adoption')), overrideAccess: true, depth: 0 })
    if (idOf((adoption as { portal?: unknown }).portal) !== acting.portal.id) return redirectTo(req, '/', 'That link is not in your portal.')
    await payload.delete({ collection: 'adoptions', id: adoption.id, overrideAccess: true })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'The link is removed. The library course is unchanged.')
  }

  if (action === 'import-token') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot import a course.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const token = text(form, 'token')
    const found = await payload.find({ collection: 'courses', overrideAccess: true, limit: 1, where: { importToken: { equals: token } } })
    const course = found.docs[0] as { id: number; importable?: boolean; title?: string } | undefined
    if (!course || course.importable === false) return redirectTo(req, text(form, 'next') || '/', 'That import token was not recognised.')
    const already = await payload.find({
      collection: 'adoptions',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ portal: { equals: acting.portal.id } }, { course: { equals: course.id } }] },
    })
    if (!already.docs.length) {
      await payload.create({
        collection: 'adoptions',
        overrideAccess: true,
        data: { kind: 'course', portal: acting.portal.id, course: course.id },
      })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, `${course.title || 'Course'} is linked. Nobody sees it until a code or a personal grant includes it.`)
  }

  if (action === 'update-code') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot edit an access code.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const codeId = Number(text(form, 'codeId'))
    const code = await payload.findByID({ collection: 'access-codes', id: codeId, overrideAccess: true, depth: 0 })
    if (idOf((code as { portal?: unknown }).portal) !== acting.portal.id) return redirectTo(req, '/', 'That access code is not in your portal.')
    const packId = Number(text(form, 'pack') || 0)
    const packIds = packId ? [packId] : ((code as { packs?: unknown[] }).packs || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    if (packId) {
      await payload.update({ collection: 'access-codes', id: codeId, overrideAccess: true, data: { packs: packIds } })
    }
    const apply = text(form, 'apply') || 'leave'
    const nextIds = await coursesInPacks(payload, packIds)
    if (apply !== 'leave') {
      const holders = await payload.find({
        collection: 'users',
        overrideAccess: true,
        depth: 0,
        limit: 200,
        where: { accessCode: { equals: codeId } },
      })
      for (const holder of holders.docs) {
        const current = Array.isArray((holder as { courseList?: unknown }).courseList)
          ? ((holder as { courseList: unknown[] }).courseList.map((item) => Number(item)).filter(Boolean))
          : []
        let courseList = current
        if (apply === 'overwrite') courseList = nextIds
        if (apply === 'add') courseList = [...new Set([...current, ...nextIds])]
        if (apply === 'remove') courseList = current.filter((id) => !nextIds.includes(id))
        await payload.update({ collection: 'users', id: holder.id, overrideAccess: true, data: { courseList } })
      }
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, apply === 'leave' ? 'Existing people were left as they are.' : 'Access updated. It is already in their account.')
  }

  if (action === 'grant') {
    if (user.role === 'learner') return redirectTo(req, '/', 'Learners cannot grant courses.')
    const learnerId = Number(text(form, 'learner'))
    const courseId = Number(text(form, 'course'))
    const learner = await payload.findByID({ collection: 'users', id: learnerId, overrideAccess: true, depth: 0 })
    if (user.role !== 'master' && portalIdOf(learner as SessionUser) !== portalIdOf(user)) {
      return redirectTo(req, '/', 'That learner is not in your portal.')
    }
    const existing = ((learner as { extraCourses?: unknown[] }).extraCourses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    await payload.update({
      collection: 'users',
      id: learnerId,
      overrideAccess: true,
      data: { extraCourses: [...new Set([...existing, courseId])] },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Granted. They can see it on the next page, without signing in again.')
  }

  if (action === 'feedback') {
    if (user.role === 'learner') return redirectTo(req, '/', 'Learners do not leave this kind of feedback.')
    const answer = await payload.findByID({ collection: 'answers', id: Number(text(form, 'answer')), overrideAccess: true, depth: 0 })
    if (user.role !== 'master' && idOf((answer as { portal?: unknown }).portal) !== portalIdOf(user)) {
      return redirectTo(req, '/', 'That answer is not in your portal.')
    }
    const body = text(form, 'body')
    if (!body) return redirectTo(req, text(form, 'next') || '/', 'Write the feedback first.')
    const audio = form.get('audio')
    let audioId: number | undefined
    if (audio instanceof File && audio.size > 0) {
      if (tooBig(audio)) return redirectTo(req, text(form, 'next') || '/', 'That file is over 200 MB.')
      const media = await payload.create({
        collection: 'media',
        overrideAccess: true,
        data: { alt: audio.name },
        file: { data: Buffer.from(await audio.arrayBuffer()), mimetype: audio.type || 'audio/webm', name: audio.name, size: audio.size },
      })
      audioId = media.id
    }
    await payload.create({
      collection: 'feedback-notes',
      overrideAccess: true,
      data: {
        answer: answer.id,
        author: user.id,
        second: Number(text(form, 'second') || 0),
        body,
        audio: audioId,
        portal: idOf((answer as { portal?: unknown }).portal) || undefined,
      },
    })
    const learnerId = idOf((answer as { user?: unknown }).user)
    if (learnerId) {
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: {
          user: learnerId,
          portal: idOf((answer as { portal?: unknown }).portal) || undefined,
          title: 'Feedback on your evidence',
          body,
          href: text(form, 'href') || '/',
        },
      })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Feedback is on the timeline.')
  }

  if (action === 'seen-welcome') {
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { seenWelcome: true } })
    return redirectTo(req, text(form, 'next') || '/')
  }

  if (action === 'watch-opt-in') {
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { shareWatch: form.get('shareWatch') === 'on' } })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Watch history preference saved.')
  }

  if (action === 'rename-course') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot rename that course.')
    const course = await payload.findByID({ collection: 'courses', id: Number(text(form, 'course')), overrideAccess: true, depth: 0 })
    if (libraryLocked(user, course as { origin?: string })) {
      return redirectTo(req, text(form, 'next') || '/', 'This course is linked from the library. You can view it or remove the link. You cannot edit the original.')
    }
    if (user.role !== 'master' && idOf((course as { portal?: unknown }).portal) !== portalIdOf(user)) {
      return redirectTo(req, '/', 'That course is not in your portal.')
    }
    await payload.update({
      collection: 'courses',
      id: course.id,
      overrideAccess: true,
      data: { title: text(form, 'title') || (course as { title?: string }).title, importable: form.get('importable') === 'on' },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Course updated.')
  }

  return redirectTo(req, '/', 'That action is not known.')
}

export { dualExtract }
