import { PortalOpeningScreen } from '@/screens/desk/opening'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { AppFrame } from '@/components/app/shell'
import { Arch } from '@/components/arch'
import { Hidden } from '@/components/app/shell'
import { portalIdOf } from '@/lib/ids'
import { getSession, loadPortal, requirePortal } from '@/server/context'
import { JourneyScreen } from '@/screens/app/journey'
import { shareOrigin } from '@/lib/site-origin'
import { portalName } from '@/server/learner'
import type { Ctx, Query } from '@/screens/common'
import { LearnerPathScreen, RecalibrateScreen } from '@/screens/app/compass'
import { GatherDetailScreen, GatherDoorScreen, GatherListScreen, GatherProposeScreen, GatherReflectScreen } from '@/screens/app/gather'
import { HomeScreen, LanesScreen } from '@/screens/app/home'
import { CourseScreen, SpeakerScreen } from '@/screens/app/course'
import { GardenDoor, GardenGeneral, GardenGhunya, GardenJibril, GardenScreen, GardenWorkbook } from '@/screens/app/garden'
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
import { AccessScreen, ContentScreen, CourseEditorScreen, LibraryScreen, guardAdmin } from '@/screens/desk/content'
import { PortalCompassScreen, StaffLearnerCompass } from '@/screens/desk/compass'
import { ProposedCompassScreen } from '@/screens/desk/compass-proposed'
import { PortalCreatorScreen } from '@/screens/desk/creator-screen'
import { PortalSheetScreen } from '@/screens/desk/sheet'
import { FeedbackScreen } from '@/screens/desk/feedback'
import { GatherAttendanceScreen, GatherDeskScreen } from '@/screens/desk/gather'
import { LiveDeskScreen } from '@/screens/desk/live'
import { LiveWatchScreen } from '@/screens/app/live'
import { NightsScreen, PlansScreen, TeachScreen } from '@/screens/desk/people'
import { PortalCircle } from '@/screens/desk/circle'
import { PortalAnnounceScreen, PortalSafetyScreen } from '@/screens/desk/safety'
import { FeatureUnavailable } from '@/components/app/feature-unavailable'
import { featureOn, type FeatureKey } from '@/lib/features'

function originOf(reqHeaders: Headers) {
  return shareOrigin(reqHeaders)
}

const plain = (value: string) => encodeURIComponent(value)

function gated(ctx: Ctx, key: FeatureKey, desk = false) {
  if (featureOn(ctx.portal, key)) return null
  return FeatureUnavailable({ base: ctx.base, feature: key, desk })
}

const OPEN_TO_ALL = new Set(['start', 'help', 'feed'])

export default async function PortalScreen({ params, searchParams }: { params: Promise<{ slug: string; screen?: string[] }>; searchParams: Promise<Query> }) {
  const { slug, screen = [] } = await params
  const query = await searchParams
  const [area, a, b] = screen
  const base = `/p/${slug}`

  // The opening and the feed work before an account exists (spec 7, P1). Everything else needs one.
  if (area === undefined || OPEN_TO_ALL.has(area)) {
    const session = await getSession()
    const portal = await loadPortal(session.payload, slug)
    if (!portal) notFound()
    const visitor = session.user
    if (visitor && visitor.role !== 'master' && portalIdOf(visitor) !== portal.id) redirect('/?error=That portal is not yours.')
    const shut = portal.closed && (!visitor || visitor.role === 'learner')
    if (!shut && area === undefined) {
      if (!visitor) redirect((await cookies()).get('hearts_opened')?.value === '1' ? `${base}/feed` : `${base}/start`)
      if (visitor.role === 'learner' && !visitor.onboarded) redirect(visitor.startingClause ? `${base}/start?after=placing` : `${base}/welcome`)
    } else if (!shut) {
      return JourneyScreen({ payload: session.payload, portal, user: visitor, base, initial: area === 'feed' ? 'feed' : area === 'help' ? 'help' : 'opener', viewAs: Boolean(session.viewAs), query: query as Record<string, string | undefined> })
    }
  }

  const { payload, user, portal } = await requirePortal(slug)
  const ctx: Ctx = { payload, user, portal, slug, base, origin: originOf(await headers()), query }

  if (portal.closed && user.role === 'learner') {
    return (
      <AppFrame testId="closed">
        <div className="splash">
          <div>
            <span className="splash-arch" aria-hidden><Arch size={72} /></span>
            <h1>{portalName(portal)} is closed for now</h1>
            <p data-testid="portal-closed">This portal has been paused. Your answers and your garden are kept safe, and will be here when it opens again.</p>
            <form action="/api/hearts" method="post" style={{ marginTop: 18 }}>
              <Hidden fields={{ action: 'logout' }} />
              <button className="pill outline block" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </AppFrame>
    )
  }

  if (area === 'admin') {
    if (user.role === 'learner') redirect(`${base}?error=${plain('That page is for the portal team. You are back in your feed.')}`)
    switch (a) {
      case undefined:
        return OverviewScreen(ctx)
      case 'content':
        return b ? CourseEditorScreen(ctx, Number(b)) : ContentScreen(ctx)
      case 'library':
        return LibraryScreen(ctx)
      case 'access':
        return AccessScreen(ctx)
      case 'teach':
        return TeachScreen(ctx)
      case 'feedback':
        return gated(ctx, 'feedback', true) || FeedbackScreen(ctx)
      case 'compass':
        return gated(ctx, 'compass', true) || (b === 'proposed' ? ProposedCompassScreen(ctx) : b ? StaffLearnerCompass(ctx, Number(b)) : PortalCompassScreen(ctx))
      case 'plans':
        return gated(ctx, 'planner', true) || PlansScreen(ctx)
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
      case 'circle':
        guardAdmin(ctx)
        return gated(ctx, 'circle', true) || PortalCircle(ctx)
      case 'ai':
        guardAdmin(ctx)
        return AiPages({ ctx, path: screen.slice(2) })
      case 'experiments':
        guardAdmin(ctx)
        return gated(ctx, 'experiments', true) || ExperimentPages({ ctx, path: screen.slice(2) })
      case 'insights':
        guardAdmin(ctx)
        return gated(ctx, 'insights', true) || InsightPages({ ctx })
      case 'calendar':
        guardAdmin(ctx)
        return CalendarPages({ ctx })
      case 'missions':
        guardAdmin(ctx)
        return gated(ctx, 'missions', true) || MissionPages({ ctx, path: screen.slice(2) })
      case 'safety':
        return PortalSafetyScreen(ctx)
      case 'announcements':
        return PortalAnnounceScreen(ctx)
      case 'sheet':
        guardAdmin(ctx)
        if (b === 'create') return PortalCreatorScreen(ctx)
        return PortalSheetScreen(ctx)
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

  switch (area) {
    case undefined:
      return HomeScreen(ctx)
    case 'lanes':
      return LanesScreen(ctx)
    case 'live':
      if (!a || !Number(a)) notFound()
      return gated(ctx, 'live') || LiveWatchScreen(ctx, Number(a))
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
      if (a === 'workbook') return gated(ctx, 'workbook') || GardenWorkbook(ctx)
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
