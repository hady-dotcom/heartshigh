import { PortalOpeningScreen } from '@/screens/desk/opening'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { AppFrame } from '@/components/app/shell'
import { Mascot } from '@/components/brand'
import { Hidden } from '@/components/app/shell'
import { portalIdOf } from '@/lib/ids'
import { getSession, loadPortal, requirePortal } from '@/server/context'
import { JourneyScreen } from '@/screens/app/journey'
import { portalName } from '@/server/learner'
import type { Ctx, Query } from '@/screens/common'
import { HomeScreen, LanesScreen } from '@/screens/app/home'
import { CourseScreen, SpeakerScreen } from '@/screens/app/course'
import { GardenClause, GardenGeneral, GardenGhunya, GardenHarvest, GardenJibril, GardenScreen, GardenWorkbook } from '@/screens/app/garden'
import { CircleScreen, MeScreen, PlanScreen, SettingsScreen } from '@/screens/app/me'
import { WelcomeScreen } from '@/screens/app/welcome'
import { OverviewScreen, PortalSettingsScreen, WizardScreen } from '@/screens/desk/overview'
import { AccessScreen, ContentScreen, CourseEditorScreen, LibraryScreen, guardAdmin } from '@/screens/desk/content'
import { NightsScreen, PlansScreen, TeachScreen } from '@/screens/desk/people'

function originOf(reqHeaders: Headers) {
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host') || 'localhost:3000'
  const proto = reqHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

const plain = (value: string) => encodeURIComponent(value)

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
      if (visitor.role === 'learner' && !visitor.onboarded) redirect(`${base}/start`)
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
            <Mascot width={120} />
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
      case 'plans':
        return PlansScreen(ctx)
      case 'nights':
        return NightsScreen(ctx)
      case 'settings':
        guardAdmin(ctx)
        return PortalSettingsScreen(ctx)
      case 'wizard':
        guardAdmin(ctx)
        return WizardScreen(ctx)
      case 'opening':
        guardAdmin(ctx)
        return PortalOpeningScreen(ctx)
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
    case 'speaker':
      if (!a) notFound()
      return SpeakerScreen(ctx, a)
    case 'course':
      if (!a || !Number(a)) notFound()
      return CourseScreen(ctx, Number(a))
    case 'garden':
      if (!a) return GardenScreen(ctx)
      if (a === 'general') return GardenGeneral(ctx)
      if (a === 'jibril') return b ? GardenClause(ctx, Number(b)) : GardenJibril(ctx)
      if (a === 'ghunya') return GardenGhunya(ctx)
      if (a === 'harvest') return GardenHarvest(ctx)
      if (a === 'workbook') return GardenWorkbook(ctx)
      notFound()
    case 'me':
      if (!a) return MeScreen(ctx)
      if (a === 'plan') return PlanScreen(ctx)
      if (a === 'circle') return CircleScreen(ctx)
      if (a === 'settings') return SettingsScreen(ctx)
      notFound()
    case 'welcome':
      return WelcomeScreen(ctx)
    case 'about':
      redirect(`${base}/welcome`)
    case 'path':
      redirect(`${base}/lanes`)
    case 'grow':
      redirect(`${base}/garden`)
    case 'chapter':
    case 'night':
      redirect(`${base}/me/circle`)
    case 'schedule':
      redirect(`${base}/me/plan`)
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
