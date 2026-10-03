import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { TierEditor } from '@/components/desk/tier-editor'
import { idOf } from '@/lib/ids'
import { gapAfter, gapBefore, PRE_ROLL, sentencesOf, TAIL, timingProblems } from '@/lib/tiers'
import { filmsForTalk, readFilmCatalogue } from '@/lib/films'
import { filesForTalk, readTypographyManifest, TYPOGRAPHY_LABEL, TYPOGRAPHY_STYLES, isTypographyStyle } from '@/lib/typography'
import { tierSourceText } from '@/server/tier-source'
import type { SessionUser } from '@/server/context'
import { rows, str } from '../common'
import { DeskFrame, masterNav } from './shell'

type MasterCtx = { payload: Payload; user: SessionUser; query: Record<string, string | undefined> }

function clock(total: number) {
  const seconds = Math.max(0, Math.round(total))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

function TypographyPanel({ tierId, lesson, chosen, inPlace, next }: { tierId: number; lesson: Record<string, unknown>; chosen: string; inPlace: boolean; next: string }) {
  const files = filesForTalk(readTypographyManifest(), str(lesson.youtubeId) || null, str(lesson.sourceTitle) || str(lesson.title))
  const style = isTypographyStyle(chosen) ? chosen : ''
  return (
    <section className="panel" style={{ marginTop: 18 }} data-testid="typography-panel">
      <header className="light"><h2>Typography</h2><span className="hint">Five ways into the same words</span></header>
      <form className="body form" action="/api/hearts" method="post">
        <Hidden fields={{ action: 'typography-save', tier: tierId, next }} />
        <p className="hint" style={{ marginTop: 0 }}>A rendered typography video can stand in for the hors d&apos;oeuvre clip. The words are the speaker&apos;s, timed from the transcript.</p>
        <div className="type-grid" data-testid="typography-styles">
          {TYPOGRAPHY_STYLES.map((name) => {
            const src = files?.styles?.[name]
            return (
              <label key={name} className={`type-card${style === name ? ' on' : ''}`}>
                <span className="type-card-head">
                  <input type="radio" name="typographyStyle" value={name} defaultChecked={style === name} data-testid={`typography-style-${name}`} />
                  <b>{TYPOGRAPHY_LABEL[name]}</b>
                </span>
                {src ? <video src={src} controls preload="metadata" data-testid={`typography-preview-${name}`} /> : <span className="hint">Not rendered yet</span>}
              </label>
            )
          })}
        </div>
        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" name="typographyInPlace" defaultChecked={inPlace} data-testid="typography-in-place" />
          Typography in place of the clip
        </label>
        <div className="actions"><button className="btn ink small" type="submit" data-testid="typography-save">Save typography</button></div>
      </form>
      <BeatFilms lesson={lesson} />
    </section>
  )
}

function BeatFilms({ lesson }: { lesson: Record<string, unknown> }) {
  const films = filmsForTalk(readFilmCatalogue(), str(lesson.youtubeId) || null)
  if (!films.length) return null
  return (
    <div className="body" data-testid="typography-beats">
      <p className="hint" style={{ marginTop: 0 }}>One film for each beat. The feed mixes these with the talk, the line, and a question.</p>
      <ul className="plain">
        {films.map((film) => (
          <li key={film.beat}>
            <a href={film.src}>{film.beat === 'hook' ? 'Hook' : film.beat === 'turn' ? 'Turn' : 'Land'}</a>
            <span className="hint"> {TYPOGRAPHY_LABEL[film.style]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Frame({ ctx, title, intro, children, testId }: { ctx: MasterCtx; title: string; intro: string; children: React.ReactNode; testId: string }) {
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={title} intro={intro} active="tiers" nav={masterNav()} brand="Hudhud" subBrand="Master desk" brandHref="/master" query={ctx.query} testId={testId}>
      {children}
    </DeskFrame>
  )
}

export async function MasterTiers(ctx: MasterCtx) {
  const { payload } = ctx
  const tiers = await rows(payload, 'talk-tiers', undefined, { limit: 500, depth: 0 })
  const lessonIds = tiers.map((tier) => idOf(tier.lesson)).filter((id): id is number => Boolean(id))
  const [lessons, points] = await Promise.all([
    lessonIds.length ? rows(payload, 'lessons', { id: { in: lessonIds } }, { limit: 500 }) : Promise.resolve([]),
    lessonIds.length ? rows(payload, 'engagement-points', { lesson: { in: lessonIds } }, { limit: 2000 }) : Promise.resolve([]),
  ])
  const sorted = [...tiers].sort((a, b) => Number(a.status === 'checked') - Number(b.status === 'checked') || Number(a.id) - Number(b.id))
  const checked = tiers.filter((tier) => tier.status === 'checked').length
  return (
    <Frame
      ctx={ctx}
      title="Talk tiers"
      intro="Each talk is served three ways: a hors d'oeuvre of 15 to 20 seconds, an appetiser of up to about 3 minutes built on a hook, a turn and a land, and the main, which is the whole talk from 0:00 with pop-up questions. The drafts come from the captions by machine and stay drafts until a person checks them here."
      testId="master-tiers"
    >
      <p className="hint" data-testid="tiers-count">{checked} of {tiers.length} talks checked by a person.</p>
      <section className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Talk</th><th>Hors d&apos;oeuvre</th><th>Appetiser</th><th className="num">Pop-ups</th><th>Status</th><th /></tr></thead>
            <tbody>
              {sorted.map((tier) => {
                const lesson = lessons.find((row) => row.id === idOf(tier.lesson))
                const own = points.filter((point) => idOf(point.lesson) === lesson?.id)
                const drafts = own.filter((point) => point.status === 'draft').length
                return (
                  <tr key={tier.id} data-testid="tier-row" data-status={str(tier.status) || 'draft'}>
                    <td><b>{str(lesson?.sourceTitle) || str(lesson?.title) || 'A talk'}</b><div className="hint">{str(lesson?.speaker)}{lesson?.durationSeconds ? ` · ${clock(Number(lesson.durationSeconds))}` : ''}</div></td>
                    <td>{clock(Number(tier.horsStart))} to {clock(Number(tier.horsEnd))}</td>
                    <td>{clock(Number(tier.appetiserStart))} to {clock(Number(tier.appetiserEnd))}</td>
                    <td className="num">{own.length}{drafts ? <div className="hint">{drafts} in draft</div> : null}</td>
                    <td>{tier.status === 'checked' ? <span className="badge teal">Checked</span> : tier.status === 'rejected' ? <span className="badge rose">Rejected</span> : <span className="badge grey">Draft, needs a human check</span>}</td>
                    <td><Link className="btn ghost small" href={`/master/tiers/${tier.id}`} data-testid="tier-open">Check</Link></td>
                  </tr>
                )
              })}
              {!tiers.length ? <tr><td colSpan={6} className="empty">No talks have tiers yet. Run npm run reseed to draft them from the shipped captions.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </Frame>
  )
}

export async function MasterTier(ctx: MasterCtx, tierId: number) {
  const { payload } = ctx
  const tier = (await rows(payload, 'talk-tiers', { id: { equals: tierId } }, { limit: 1, depth: 0 }))[0]
  if (!tier) notFound()
  const lesson = (await rows(payload, 'lessons', { id: { equals: idOf(tier.lesson) } }, { limit: 1 }))[0]
  if (!lesson) notFound()
  const points = (await rows(payload, 'engagement-points', { lesson: { equals: lesson.id } }, { limit: 100 })).sort((a, b) => Number(a.second) - Number(b.second))
  const duration = Number(lesson.durationSeconds || 0)
  const sentences = sentencesOf(tierSourceText(lesson as { youtubeId?: string; transcript?: string }))
  const lines = sentences.map((sentence, index) => {
    const before = gapBefore(sentences, index)
    const after = gapAfter(sentences, index, duration || Infinity)
    return { start: sentence.start, end: sentence.end, text: sentence.text, inAt: Math.max(before.from, before.to - PRE_ROLL), outAt: Math.min(after.to, after.from + TAIL) }
  })
  const late = timingProblems(duration || null, points.map((point) => ({ label: `The pop-up at ${clock(Number(point.second))}`, start: Number(point.second) })))
  const next = `/master/tiers/${tier.id}`
  const title = str(lesson.sourceTitle) || str(lesson.title) || 'A talk'
  return (
    <Frame ctx={ctx} title={title} intro={`${str(lesson.speaker)}. ${str(tier.note) || 'Times and lines come from the captions by machine. Watch each tier and fix what reads wrong before marking it checked.'}`} testId="master-tier">
      <p style={{ marginTop: 0 }}><Link href="/master/tiers" data-testid="tiers-back">‹ All talk tiers</Link></p>
      <TierEditor
        tier={{
          id: Number(tier.id),
          horsStart: Number(tier.horsStart),
          horsEnd: Number(tier.horsEnd),
          appetiserStart: Number(tier.appetiserStart),
          appetiserEnd: Number(tier.appetiserEnd),
          horsQuote: str(tier.horsQuote),
          hook: str(tier.hook),
          turn: str(tier.turn),
          land: str(tier.land),
          offerResume: tier.offerResume !== false,
          note: str(tier.note),
          checked: tier.status === 'checked',
        }}
        youtubeId={str(lesson.youtubeId) || null}
        duration={duration}
        lines={lines}
        next={next}
      />
      <TypographyPanel tierId={Number(tier.id)} lesson={lesson} chosen={str(tier.typographyStyle)} inPlace={Boolean(tier.typographyInPlace)} next={next} />
      <section className="panel" style={{ marginTop: 18 }} data-testid="tier-popups">
        <header className="light"><h2>Pop-ups in the main ({points.length})</h2><span className="hint">Drafts are never shown to learners</span></header>
        {late.length ? <ul className="hint tier-warn" data-testid="popup-late">{late.map((problem) => <li key={problem}>{problem}</li>)}</ul> : null}
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Time and question</th><th>Status</th><th /></tr></thead>
            <tbody>
              {points.map((point) => {
                const draft = point.status === 'draft'
                return (
                  <tr key={point.id} data-testid="popup-row" data-status={draft ? 'draft' : 'published'}>
                    <td>
                      <form className="form popup-edit" action="/api/hearts" method="post">
                        <Hidden fields={{ action: 'popup-save', lesson: lesson.id, point: point.id, next }} />
                        <div className="cols">
                          <label className="stack">At<input type="text" name="second" defaultValue={clock(Number(point.second))} style={{ width: 90 }} data-testid="popup-second" /></label>
                          <label className="stack" style={{ flex: 1 }}>Question<textarea name="prompt" rows={2} defaultValue={str(point.prompt)} data-testid="popup-prompt-input" /></label>
                        </div>
                        {draft && str(point.draftNote) ? <p className="hint" style={{ margin: 0 }}>{str(point.draftNote)}</p> : null}
                        <div className="actions"><button className="btn ghost small" type="submit" data-testid="popup-save">Save pop-up</button></div>
                      </form>
                    </td>
                    <td>{draft ? <span className="badge grey">Draft</span> : <span className="badge teal">Published</span>}</td>
                    <td>
                      <form action="/api/hearts" method="post">
                        <Hidden fields={{ action: 'popup-publish', lesson: lesson.id, point: point.id, status: draft ? 'published' : 'draft', next }} />
                        <button className={`btn small ${draft ? 'teal' : 'ghost'}`} type="submit" data-testid="popup-publish">{draft ? 'Publish' : 'Back to draft'}</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
              {!points.length ? <tr><td colSpan={3} className="empty">No pop-ups on this talk yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <form className="body form" action="/api/hearts" method="post" data-testid="popup-add">
          <Hidden fields={{ action: 'popup-save', lesson: lesson.id, next }} />
          <div className="cols">
            <label className="stack">At<input type="text" name="second" placeholder="12:30" style={{ width: 90 }} data-testid="popup-add-second" /></label>
            <label className="stack" style={{ flex: 1 }}>Question<textarea name="prompt" rows={2} data-testid="popup-add-prompt" /></label>
            <label className="stack">Kind<select name="kind" defaultValue="reflection"><option value="reflection">Reflection</option><option value="task">Task</option><option value="question">Question</option></select></label>
          </div>
          <div className="actions"><button className="btn ink small" type="submit" data-testid="popup-add-save">Add as a draft</button></div>
        </form>
      </section>
    </Frame>
  )
}
