import type { Metadata } from 'next'
import { PortalOpeningScreen } from '@/screens/desk/opening'
import { PortalQuestionsScreen } from '@/screens/desk/placing'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { AppFrame } from '@/components/app/shell'
import { Arch } from '@/components/arch'
import { Hidden } from '@/components/app/shell'
import { portalIdOf } from '@/lib/ids'
import { getPayloadClient, getSession, loadPortal, requirePortal } from '@/server/context'
import { JourneyScreen } from '@/screens/app/journey'
import { shareOrigin } from '@/lib/site-origin'
import { portalName } from '@/server/learner'
import { rows, type Ctx, type Query } from '@/screens/common'
import { LearnerPathScreen, RecalibrateScreen } from '@/screens/app/compass'
import { GatherDetailScreen, GatherDoorScreen, GatherListScreen, GatherProposeScreen, GatherReflectScreen } from '@/screens/app/gather'
import { HomeScreen, LanesScreen } from '@/screens/app/home'
import { LaneScreen } from '@/screens/app/lane'
import { CourseScreen, SpeakerScreen } from '@/screens/app/course'
import { GardenDoor, GardenGeneral, GardenGhunya, GardenJibril, GardenScreen, GardenWorkbook, GardenWorkbookEntry } from '@/screens/app/garden'
import { GardenHarvest } from '@/screens/app/harvest'
import { CircleScreen, MeScreen, PlanScreen, SavedScreen, SettingsScreen } from '@/screens/app/me'
import { WeekScreen } from '@/screens/app/week'
import { WelcomeScreen } from '@/screens/app/welcome'
import { AiPages } from '@/screens/desk/ai'
import { ExperimentPages } from '@/screens/desk/experiments'
import { InsightPages } from '@/screens/desk/insights'
import { CalendarPages } from '@/screens/desk/calendar'
import { MissionPages } from '@/screens/desk/missions'
import { MissionScreen, ShapedScreen, SupportScreen } from '@/screens/app/mission'
import { OverviewScreen, PortalSettingsScreen, WizardScreen } from '@/screens/desk/overview'
import { AccessScreen, ContentScreen, CourseEditorScreen, LibraryScreen, LibraryTalkScreen, guardAdmin } from '@/screens/desk/content'
import { PortalBringInScreen } from '@/screens/desk/bring-in'
import { PortalCompassScreen, StaffLearnerCompass } from '@/screens/desk/compass'
import { ProposedCompassScreen } from '@/screens/desk/compass-proposed'
import { PortalCreatorScreen } from '@/screens/desk/creator-screen'
import { PortalSheetScreen } from '@/screens/desk/sheet'
import { FeedbackScreen } from '@/screens/desk/feedback'
import { GatherAttendanceScreen, GatherDeskScreen } from '@/screens/desk/gather'
import { LiveDeskScreen } from '@/screens/desk/live'
import { LiveIndexScreen, LiveWatchScreen } from '@/screens/app/live'
import { NightsScreen, PlansScreen, TeachScreen } from '@/screens/desk/people'
import { PortalDiaries, PortalDiaryDetail, PortalLearnerDetail, PortalPlanDetail } from '@/screens/desk/learner-desk'
import { PortalCircle } from '@/screens/desk/circle'
import { PortalBin } from '@/screens/desk/bin'
import { PortalAnnounceScreen, PortalSafetyScreen } from '@/screens/desk/safety'
import { BackToDesk } from '@/components/app/back-to-desk'
import { FeatureUnavailable } from '@/components/app/feature-unavailable'
import { featureOn, type FeatureKey } from '@/lib/features'
import { isSequencePortal } from '@/lib/sequence'
import { isDemoRole, withDemoQuery, type DemoRole } from '@/lib/parenting-demo'
import { demoUser, loadDemoRoom, portalWithDemoFeatures } from '@/server/parenting-demo'
import type { DemoBag } from '@/screens/common'
import { SequenceGarden, SequenceGate, SequenceHome, SequenceMe } from '@/screens/app/sequence'
import { SequenceCodes, SequenceDesk, SequenceFeatures, SequenceLearners, SequenceOverview } from '@/screens/desk/sequence'

function originOf(reqHeaders: Headers) {
  return shareOrigin(reqHeaders)
}

const plain = (value: string) => encodeURIComponent(value)

function gated(ctx: Ctx, key: FeatureKey, desk = false) {
  if (featureOn(ctx.portal, key)) return null
  return FeatureUnavailable({ base: ctx.base, feature: key, desk })
}

const OPEN_TO_ALL = new Set(['start', 'help', 'feed'])

const HEARTS_META = {
  title: 'HEARTS',
  description: 'Short clips from real talks, full courses, and a circle that meets in person.',
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params
    const payload = await getPayloadClient()
    const portal = await loadPortal(payload, slug)
    if (portal && isSequencePortal(portal)) {
      const name = String(portal.brandName || portalName(portal))
      return {
        title: name,
        description: `${name}. Watch the films in order.`,
        applicationName: name,
        manifest: '/hady-home.webmanifest',
        appleWebApp: { capable: true, title: name, statusBarStyle: 'black-translucent' },
        icons: {
          icon: [{ url: '/icons/hady-home.svg', type: 'image/svg+xml' }],
          apple: [{ url: '/icons/hady-home.svg' }],
        },
      }
    }
  } catch {
    return HEARTS_META
  }
  return HEARTS_META
}

export default async function PortalScreen({ params, searchParams }: { params: Promise<{ slug: string; screen?: string[] }>; searchParams: Promise<Query> }) {
  const { slug, screen = [] } = await params
  const query = await searchParams
  const [area, a, b] = screen
  const base = `/p/${slug}`

  if (area === 'garden') {
    const session = await getSession()
    const portal = await loadPortal(session.payload, slug)
    if (portal && isSequencePortal(portal) && !session.user && !portal.closed) {
      return SequenceGarden({ payload: session.payload, user: session.user as Ctx['user'], portal, slug, base, origin: '', query })
    }
  }

  // The opening and the feed work before an account exists (spec 7, P1). Everything else needs one.
  if (area === undefined || OPEN_TO_ALL.has(area)) {
    const session = await getSession()
    const portal = await loadPortal(session.payload, slug)
    if (!portal) notFound()
    const visitor = session.user
    if (visitor && visitor.role !== 'master' && portalIdOf(visitor) !== portal.id) redirect('/?error=That portal is not yours.')
    const shut = portal.closed && (!visitor || visitor.role === 'learner')
    if (!shut && area === undefined) {
      if (!visitor) {
        if (isSequencePortal(portal)) return SequenceGate({ payload: session.payload, portal, base })
        redirect((await cookies()).get('hearts_opened')?.value === '1' ? `${base}/feed` : `${base}/start`)
      }
      if (visitor.role === 'learner' && !visitor.onboarded) {
        if (isSequencePortal(portal)) redirect(`${base}/welcome`)
        const started = await rows(session.payload, 'lesson-visits', { user: { equals: visitor.id } }, { limit: 1 })
        if (!started.length) redirect(visitor.startingClause ? `${base}/start?after=placing` : `${base}/welcome`)
      }
    } else if (!shut) {
      if (isSequencePortal(portal)) {
        if (!visitor) return SequenceGate({ payload: session.payload, portal, base })
        redirect(base)
      }
      return (
        <>
          <BackToDesk user={visitor} portal={portal} />
          {await JourneyScreen({ payload: session.payload, portal, user: visitor, base, initial: area === 'feed' ? 'feed' : area === 'help' ? 'help' : 'opener', viewAs: Boolean(session.viewAs), query: query as Record<string, string | undefined> })}
        </>
      )
    }
  }

  const loaded = await requirePortal(slug)
  let { payload, user, portal } = loaded
  let demo: DemoBag | undefined
  if (slug === 'parenting' && query.demo) {
    const room = await loadDemoRoom(payload, String(query.demo))
    if (!room) notFound()
    const role: DemoRole = isDemoRole(String(query.as || '')) ? (query.as as DemoRole) : 'learner'
    if ((area === 'admin' || area === 'master') && role === 'learner') redirect(withDemoQuery(base, room.token, 'learner'))
    user = demoUser(role === 'master' ? 'portal' : role, room.cast, portal.id)
    portal = portalWithDemoFeatures(portal, room.state)
    demo = { token: room.token, role, cast: room.cast, state: room.state }
  }
  const ctx: Ctx = { payload, user, portal, slug, base, origin: originOf(await headers()), query, demo }

  if (portal.closed && user.role === 'learner') {
    return (
      <AppFrame testId="closed" help={isSequencePortal(portal) ? 'sequence-closed' : undefined} brand={isSequencePortal(portal) ? { colour: portal.colour || '#1f3a5f', accent: portal.accent || '#e07a5f' } : undefined}>
        <div className="splash">
          <div>
            {isSequencePortal(portal) ? null : <span className="splash-arch" aria-hidden><Arch size={72} /></span>}
            <h1>{portalName(portal)} is closed for now</h1>
            <p data-testid="portal-closed">{isSequencePortal(portal) ? 'This portal is paused. Your progress is kept, and will be here when it opens again.' : 'This portal has been paused. Your answers and your garden are kept safe, and will be here when it opens again.'}</p>
            <form action="/api/hearts" method="post" style={{ marginTop: 18 }}>
              <Hidden fields={{ action: 'logout' }} />
              <button className="pill outline block" type="submit" data-testid="logout">Log out</button>
            </form>
          </div>
        </div>
      </AppFrame>
    )
  }

  if (area === 'admin') {
    if (user.role === 'learner') redirect(`${base}?error=${plain('That page is for the portal team. You are back in your feed.')}`)
    if (isSequencePortal(portal)) {
      const away = new Set(['content', 'bring-in', 'library', 'sheet', 'opening', 'questions', 'wizard', 'circle', 'ai', 'experiments', 'insights', 'calendar', 'missions', 'feedback', 'compass', 'plans', 'diaries', 'nights', 'gather', 'live', 'safety', 'announcements', 'courses', 'adopt'])
      if (a === 'settings') redirect(`${base}/admin/sequence#look`)
      if (a && away.has(a)) redirect(`${base}/admin/features`)
      if (a === 'teach' && b) redirect(`${base}/admin/teach`)
    }
    switch (a) {
      case undefined:
        if (isSequencePortal(portal)) return SequenceOverview(ctx)
        return OverviewScreen(ctx)
      case 'content':
        return b ? CourseEditorScreen(ctx, Number(b)) : ContentScreen(ctx)
      case 'bring-in':
        guardAdmin(ctx)
        return PortalBringInScreen(ctx)
      case 'library':
        if (b === 'talk') {
          const talkId = Number(screen[3])
          if (!talkId) notFound()
          return LibraryTalkScreen(ctx, talkId)
        }
        return LibraryScreen(ctx)
      case 'features':
        if (!isSequencePortal(portal)) notFound()
        guardAdmin(ctx)
        return SequenceFeatures(ctx)
      case 'access':
        if (isSequencePortal(portal)) return SequenceCodes(ctx)
        return AccessScreen(ctx)
      case 'teach':
        if (isSequencePortal(portal)) return SequenceLearners(ctx)
        if (b) {
          if (!Number(b)) notFound()
          return PortalLearnerDetail(ctx, Number(b))
        }
        return TeachScreen(ctx)
      case 'answers':
        if (!b || !Number(b)) notFound()
        redirect(`${base}/admin/teach?answer=${encodeURIComponent(b)}`)
      case 'feedback':
        return gated(ctx, 'feedback', true) || FeedbackScreen(ctx)
      case 'compass':
        return gated(ctx, 'compass', true) || (b === 'proposed' ? ProposedCompassScreen(ctx) : b ? StaffLearnerCompass(ctx, Number(b)) : PortalCompassScreen(ctx))
      case 'plans':
        if (b) {
          if (!Number(b)) notFound()
          return gated(ctx, 'planner', true) || PortalPlanDetail(ctx, Number(b))
        }
        return gated(ctx, 'planner', true) || PlansScreen(ctx)
      case 'diaries':
        if (b) {
          if (!Number(b)) notFound()
          return gated(ctx, 'workbook', true) || PortalDiaryDetail(ctx, Number(b))
        }
        return gated(ctx, 'workbook', true) || PortalDiaries(ctx)
      case 'nights':
        return gated(ctx, 'gather', true) || NightsScreen(ctx)
      case 'gather': {
        const closed = gated(ctx, 'gather', true)
        if (closed) return closed
        if (b === 'attendance') return GatherAttendanceScreen(ctx)
        return GatherDeskScreen(ctx)
      }
      case 'live':
        return gated(ctx, 'live', true) || LiveDeskScreen(ctx)
      case 'settings':
        guardAdmin(ctx)
        return PortalSettingsScreen(ctx)
      case 'wizard':
        guardAdmin(ctx)
        return WizardScreen(ctx)
      case 'opening':
        guardAdmin(ctx)
        return PortalOpeningScreen(ctx)
      case 'questions':
        guardAdmin(ctx)
        return PortalQuestionsScreen(ctx)
      case 'circle':
        guardAdmin(ctx)
        return gated(ctx, 'circle', true) || PortalCircle(ctx)
      case 'ai':
        guardAdmin(ctx)
        return gated(ctx, 'ai', true) || AiPages({ ctx, path: screen.slice(2) })
      case 'experiments':
        guardAdmin(ctx)
        return gated(ctx, 'experiments', true) || ExperimentPages({ ctx, path: screen.slice(2) })
      case 'insights':
        guardAdmin(ctx)
        return gated(ctx, 'insights', true) || InsightPages({ ctx, path: screen.slice(2) })
      case 'calendar':
        guardAdmin(ctx)
        return gated(ctx, 'calendar', true) || CalendarPages({ ctx })
      case 'missions':
        guardAdmin(ctx)
        return gated(ctx, 'missions', true) || MissionPages({ ctx, path: screen.slice(2) })
      case 'safety':
        return PortalSafetyScreen(ctx)
      case 'announcements':
        return gated(ctx, 'announcements', true) || PortalAnnounceScreen(ctx)
      case 'bin':
        guardAdmin(ctx)
        return PortalBin(ctx)
      case 'sheet':
        guardAdmin(ctx)
        if (b === 'create') return PortalCreatorScreen(ctx)
        return PortalSheetScreen(ctx)
      case 'sequence':
        if (!isSequencePortal(portal)) notFound()
        return SequenceDesk(ctx)
      case 'courses':
        redirect(b ? `${base}/admin/content/${b}` : `${base}/admin/content`)
      case 'codes':
        redirect(`${base}/admin/access`)
      case 'adopt':
        redirect(`${base}/admin/library`)
      default:
        notFound()
    }
  }

  return (
    <>
      <BackToDesk user={user} portal={portal} />
      {await learnerArea(area, a, b, ctx, payload)}
    </>
  )
}

async function learnerArea(area: string | undefined, a: string | undefined, b: string | undefined, ctx: Ctx, payload: Ctx['payload']) {
  const { base } = ctx
  const sequence = isSequencePortal(ctx.portal)
  if (sequence && area && ['lanes', 'week', 'gather', 'live', 'mission', 'recalibrate', 'speaker', 'start', 'help', 'feed'].includes(area)) redirect(base)
  switch (area) {
    case undefined:
      if (sequence) return SequenceHome(ctx)
      return HomeScreen(ctx)
    case 'lanes':
      if (a) return LaneScreen(ctx, a)
      return LanesScreen(ctx)
    case 'live': {
      const closed = gated(ctx, 'live')
      if (closed) return closed
      if (!a) return LiveIndexScreen(ctx)
      if (!Number(a)) notFound()
      return LiveWatchScreen(ctx, Number(a))
    }
    case 'gather': {
      const closed = gated(ctx, 'gather')
      if (closed) return closed
      if (!a) return GatherListScreen(ctx)
      if (a === 'propose') return GatherProposeScreen(ctx)
      if (!Number(a)) notFound()
      if (b === 'door') return GatherDoorScreen(ctx, Number(a))
      if (b === 'reflect') return GatherReflectScreen(ctx, Number(a))
      return GatherDetailScreen(ctx, Number(a))
    }
    case 'speaker':
      if (!a) notFound()
      return SpeakerScreen(ctx, a)
    case 'course':
      if (!a || !Number(a)) notFound()
      return CourseScreen(ctx, Number(a))
    case 'garden':
      if (sequence) return SequenceGarden(ctx)
      if (a === 'workbook') return gated(ctx, 'workbook') || (b && /^\d+$/.test(b) ? GardenWorkbookEntry(ctx, Number(b)) : GardenWorkbook(ctx))
      {
        const closed = gated(ctx, 'garden')
        if (closed) return closed
      }
      if (!a) return GardenScreen(ctx)
      if (a === 'general') return GardenGeneral(ctx)
      if (a === 'jibril') return b ? GardenDoor(ctx, b) : GardenJibril(ctx)
      if (a === 'ghunya') return GardenGhunya(ctx)
      if (a === 'harvest') return GardenHarvest(ctx)
      notFound()
    case 'week':
      return WeekScreen(ctx)
    case 'me':
      if (sequence) {
        if (a) redirect(`${base}/me`)
        return SequenceMe(ctx)
      }
      if (!a) return MeScreen(ctx)
      if (a === 'plan' || a === 'week') return gated(ctx, 'planner') || PlanScreen(ctx)
      if (a === 'circle') return CircleScreen(ctx)
      if (a === 'settings') return SettingsScreen(ctx)
      if (a === 'saved') return SavedScreen(ctx)
      if (a === 'path') return gated(ctx, 'compass') || LearnerPathScreen(ctx)
      if (a === 'shaped') return gated(ctx, 'missions') || ShapedScreen(ctx)
      if (a === 'help') return SupportScreen(ctx)
      notFound()
    case 'mission':
      if (!a || !Number(a)) notFound()
      return MissionScreen(ctx, Number(a))
    case 'recalibrate':
      return gated(ctx, 'compass') || RecalibrateScreen(ctx)
    case 'welcome':
      return WelcomeScreen(ctx)
    case 'about':
      redirect(`${base}/welcome`)
    case 'path':
      redirect(`${base}/lanes`)
    case 'grow':
      redirect(featureOn(ctx.portal, 'garden') ? `${base}/garden` : base)
    case 'chapter':
    case 'night':
      redirect(`${base}/me/circle`)
    case 'schedule':
      redirect(`${base}/week`)
    case 'watch': {
      const lesson = a ? await payload.findByID({ collection: 'lessons', id: Number(a), overrideAccess: true, depth: 0 }).catch(() => null) : null
      const courseId = lesson ? (typeof lesson.course === 'object' && lesson.course ? lesson.course.id : lesson.course) : null
      if (!lesson || !courseId) notFound()
      redirect(`${base}/course/${courseId}?part=${lesson.id}`)
    }
    default:
      notFound()
  }
}
