import Link from 'next/link'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { ReviewKeys, ReviewPlayer } from '@/components/desk/review'
import { idOf } from '@/lib/ids'
import { pendingForLesson } from '@/server/ai-desk'
import { showUncheckedTalks } from '@/server/opening'
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

const STATUS_ORDER: Record<string, number> = { draft: 0, rejected: 1, checked: 2, published: 2 }

function Frame({ ctx, title, intro, children, testId }: { ctx: MasterCtx; title: string; intro: string; children: React.ReactNode; testId: string }) {
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={title} intro={intro} active="review" nav={masterNav()} brand="Hudhud" subBrand="Master desk" brandHref="/master" query={ctx.query} testId={testId}>
      <ReviewKeys />
      {children}
    </DeskFrame>
  )
}

function Tabs({ active, tiers, popups }: { active: 'tiers' | 'popups'; tiers: number; popups: number }) {
  return (
    <div className="actions review-tabs" data-testid="review-tabs">
      <Link className={`btn small ${active === 'tiers' ? 'ink' : 'ghost'}`} href="/master/review" data-testid="review-tab-tiers">Talk tiers ({tiers} to review)</Link>
      <Link className={`btn small ${active === 'popups' ? 'ink' : 'ghost'}`} href="/master/review/popups" data-testid="review-tab-popups">Pop-ups ({popups} to review)</Link>
    </div>
  )
}

function Decision({ action, idName, id, decision, label, keyName, tone, next, testId }: { action: string; idName: string; id: number; decision: string; label: string; keyName: string; tone: string; next: string; testId: string }) {
  return (
    <form action="/api/hearts" method="post">
      <Hidden fields={{ action, [idName]: id, decision, next }} />
      <button className={`btn ${tone}`} type="submit" data-key={keyName} data-testid={testId}>{label} <kbd>{keyName.toUpperCase()}</kbd></button>
    </form>
  )
}

function Stepper({ index, total, prev, next }: { index: number; total: number; prev: string | null; next: string | null }) {
  return (
    <div className="actions review-step">
      {prev ? <Link className="btn ghost small" href={prev} data-key="k" data-testid="review-prev">‹ Previous <kbd>K</kbd></Link> : <span className="btn ghost small" aria-disabled="true">‹ Previous</span>}
      <span className="hint" data-testid="review-position">{index + 1} of {total}</span>
      {next ? <Link className="btn ghost small" href={next} data-key="j" data-testid="review-next">Next <kbd>J</kbd> ›</Link> : <span className="btn ghost small" aria-disabled="true">Next ›</span>}
    </div>
  )
}

function Shortcuts({ extra }: { extra: string }) {
  return <p className="hint review-keys" data-testid="review-shortcuts">Keys: A approve, R reject, E adjust, {extra}, J or → next, K or ← previous.</p>
}

export async function MasterReview(ctx: MasterCtx) {
  const { payload, query } = ctx
  const [tiers, showUnchecked, drafts] = await Promise.all([
    rows(payload, 'talk-tiers', undefined, { limit: 500, depth: 0 }),
    showUncheckedTalks(payload),
    payload.count({ collection: 'engagement-points', overrideAccess: true, where: { status: { equals: 'draft' } } }),
  ])
  const sorted = [...tiers].sort((a, b) => (STATUS_ORDER[str(a.status) || 'draft'] ?? 0) - (STATUS_ORDER[str(b.status) || 'draft'] ?? 0) || Number(a.id) - Number(b.id))
  const waiting = tiers.filter((tier) => (tier.status || 'draft') === 'draft').length
  const approved = tiers.filter((tier) => tier.status === 'checked').length
  const rejected = tiers.filter((tier) => tier.status === 'rejected').length
  const wanted = Number(query.tier)
  const index = Math.max(0, wanted ? sorted.findIndex((tier) => Number(tier.id) === wanted) : 0)
  const tier = sorted[index]
  const lesson = tier ? (await rows(payload, 'lessons', { id: { equals: idOf(tier.lesson) } }, { limit: 1 }))[0] : null
  const href = (at: number) => (sorted[at] ? `/master/review?tier=${sorted[at].id}` : null)
  const following = href(index + 1) || href(0) || '/master/review'
  const status = str(tier?.status) || 'draft'
  const pending = lesson ? (await pendingForLesson(payload, lesson.id)).filter((row) => row.protectsKind === 'talk-tier' || row.stepSlug === 'hors-doeuvre' || row.stepSlug === 'appetiser-cut') : []
  return (
    <Frame
      ctx={ctx}
      title="Review"
      intro="One talk at a time: watch the hors d'oeuvre and the appetiser, read the hook, turn and land, then approve, adjust or reject. Approved talks reach learners whatever the setting below; rejected talks never do."
      testId="master-review"
    >
      <Tabs active="tiers" tiers={waiting} popups={drafts.totalDocs} />
      <section className="panel review-flag" data-testid="review-flag">
        <div className="body review-flag-body">
          <div>
            <b>Show unchecked talks to learners</b>
            <p className="hint" style={{ margin: 0 }}>{showUnchecked ? 'On: drafts are served as well as approved talks. This is on for the demo; it is off by default in production.' : 'Off: learners see approved talks only. This is the default in production.'}</p>
          </div>
          <form action="/api/hearts" method="post">
            <Hidden fields={{ action: 'show-unchecked', value: showUnchecked ? 'off' : 'on', next: tier ? `/master/review?tier=${tier.id}` : '/master/review' }} />
            <button className={`btn small ${showUnchecked ? 'ghost' : 'teal'}`} type="submit" data-testid="show-unchecked" data-state={showUnchecked ? 'on' : 'off'}>{showUnchecked ? 'Turn off' : 'Turn on'}</button>
          </form>
        </div>
      </section>
      <p className="hint" data-testid="review-counts">{approved} approved, {waiting} waiting, {rejected} rejected, of {tiers.length} talks.</p>
      {tier && lesson ? (
        <section className="panel review-card" data-testid="review-card" data-tier={tier.id} data-status={status}>
          <header className="light">
            <h2>{str(lesson.sourceTitle) || str(lesson.title) || 'A talk'}</h2>
            <span className={`badge ${status === 'checked' ? 'teal' : status === 'rejected' ? 'rose' : 'grey'}`} data-testid="review-status">{status === 'checked' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Waiting for review'}</span>
          </header>
          <div className="body review-grid">
            <div>
              <ReviewPlayer
                youtubeId={str(lesson.youtubeId) || null}
                autoplay={query.play}
                segments={[
                  { key: 'h', label: `Hors d'oeuvre, ${clock(Number(tier.horsStart))} to ${clock(Number(tier.horsEnd))}`, start: Number(tier.horsStart), end: Number(tier.horsEnd) },
                  { key: 'p', label: `Appetiser, ${clock(Number(tier.appetiserStart))} to ${clock(Number(tier.appetiserEnd))}`, start: Number(tier.appetiserStart), end: Number(tier.appetiserEnd) },
                ]}
              />
              <p className="hint">{str(lesson.speaker)}{lesson.durationSeconds ? `, talk length ${clock(Number(lesson.durationSeconds))}` : ''}</p>
            </div>
            <div>
              {pending.length ? <p className="hint" data-testid="new-draft-available">New draft available. The approved cut is unchanged. <Link href={`/master/ai/ingest/${lesson.id}`}>Read it on the ingest view</Link>.</p> : null}
              <dl className="review-lines" data-testid="review-lines">
                <dt>Hors d&apos;oeuvre line</dt><dd data-testid="review-hors">{str(tier.horsQuote)}</dd>
                <dt>Hook <span className="hint">{clock(Number(tier.hookAt ?? tier.appetiserStart))}</span></dt><dd data-testid="review-hook">{str(tier.hook)}</dd>
                <dt>Turn <span className="hint">{clock(Number(tier.turnAt ?? tier.appetiserStart))}</span></dt><dd data-testid="review-turn">{str(tier.turn)}</dd>
                <dt>Land <span className="hint">{clock(Number(tier.landAt ?? tier.appetiserEnd))}</span></dt><dd data-testid="review-land">{str(tier.land)}</dd>
              </dl>
              <div className="actions review-decide">
                <Decision action="tier-review" idName="tier" id={Number(tier.id)} decision="approve" label="Approve" keyName="a" tone="teal" next={following} testId="review-approve" />
                <Link className="btn ghost" href={`/master/tiers/${tier.id}`} data-key="e" data-testid="review-adjust">Adjust <kbd>E</kbd></Link>
                <Decision action="tier-review" idName="tier" id={Number(tier.id)} decision="reject" label="Reject" keyName="r" tone="ghost" next={following} testId="review-reject" />
                {status !== 'draft' ? <Decision action="tier-review" idName="tier" id={Number(tier.id)} decision="reopen" label="Back to waiting" keyName="u" tone="ghost" next={`/master/review?tier=${tier.id}`} testId="review-reopen" /> : null}
              </div>
              <Stepper index={index} total={sorted.length} prev={href(index - 1)} next={href(index + 1)} />
              <Shortcuts extra="H plays the hors d'oeuvre, P plays the appetiser" />
            </div>
          </div>
        </section>
      ) : (
        <p className="empty">No talks have tiers yet. Run npm run reseed to draft them from the shipped captions.</p>
      )}
    </Frame>
  )
}

export async function MasterReviewPopups(ctx: MasterCtx) {
  const { payload, query } = ctx
  const [points, tiers] = await Promise.all([rows(payload, 'engagement-points', undefined, { limit: 5000, depth: 0 }), rows(payload, 'talk-tiers', undefined, { limit: 500, depth: 0 })])
  const tierLessons = new Set(tiers.map((tier) => idOf(tier.lesson)))
  const own = points.filter((point) => tierLessons.has(idOf(point.lesson)))
  const sorted = [...own].sort((a, b) => (STATUS_ORDER[str(a.status) || 'draft'] ?? 0) - (STATUS_ORDER[str(b.status) || 'draft'] ?? 0) || Number(idOf(a.lesson)) - Number(idOf(b.lesson)) || Number(a.second) - Number(b.second))
  const live = own.filter((point) => point.status === 'published').length
  const waiting = own.filter((point) => (point.status || 'draft') === 'draft').length
  const withLive = new Set(own.filter((point) => point.status === 'published').map((point) => idOf(point.lesson)))
  const bare = tiers.filter((tier) => !withLive.has(idOf(tier.lesson))).length
  const tiersWaiting = tiers.filter((tier) => (tier.status || 'draft') === 'draft').length
  const wanted = Number(query.point)
  const index = Math.max(0, wanted ? sorted.findIndex((point) => Number(point.id) === wanted) : 0)
  const point = sorted[index]
  const lesson = point ? (await rows(payload, 'lessons', { id: { equals: idOf(point.lesson) } }, { limit: 1 }))[0] : null
  const tier = point ? tiers.find((row) => idOf(row.lesson) === idOf(point.lesson)) : null
  const href = (at: number) => (sorted[at] ? `/master/review/popups?point=${sorted[at].id}` : null)
  const following = href(index + 1) || href(0) || '/master/review/popups'
  const status = str(point?.status) || 'draft'
  const options = Array.isArray(point?.options) ? (point.options as unknown[]).map((option) => (typeof option === 'string' ? option : str((option as { label?: string })?.label))).filter(Boolean) : []
  const second = Number(point?.second || 0)
  const pending = lesson ? (await pendingForLesson(payload, lesson.id)).filter((row) => row.protectsKind === 'engagement-point' && Number(row.protectsId) === Number(point?.id)) : []
  return (
    <Frame
      ctx={ctx}
      title="Review pop-ups"
      intro="Each pop-up pauses the main at its moment and asks the learner one thing. Watch the lead-in, read the question, then approve and publish, adjust or reject. Only published pop-ups reach learners."
      testId="master-review-popups"
    >
      <Tabs active="popups" tiers={tiersWaiting} popups={waiting} />
      <p className="hint" data-testid="review-counts">{live} of {own.length} pop-ups are live. {bare} of {tiers.length} talks have none live yet.</p>
      {point && lesson ? (
        <section className="panel review-card" data-testid="review-card" data-point={point.id} data-status={status}>
          <header className="light">
            <h2>{str(lesson.sourceTitle) || str(lesson.title) || 'A talk'}</h2>
            <span className={`badge ${status === 'published' ? 'teal' : status === 'rejected' ? 'rose' : 'grey'}`} data-testid="review-status">{status === 'published' ? 'Live' : status === 'rejected' ? 'Rejected' : 'Waiting for review'}</span>
          </header>
          <div className="body review-grid">
            <div>
              <ReviewPlayer youtubeId={str(lesson.youtubeId) || null} autoplay={query.play} segments={[{ key: 'p', label: `The lead-in, ${clock(Math.max(0, second - 20))} to ${clock(second)}`, start: Math.max(0, second - 20), end: second + 1 }]} />
              <p className="hint">{str(lesson.speaker)}. The main pauses at {clock(second)}.</p>
            </div>
            <div>
              {pending.length ? <p className="hint" data-testid="new-draft-available">New draft available. This pop-up was left as it is. <Link href={`/master/ai/ingest/${lesson.id}`}>Read the draft on the ingest view</Link>.</p> : null}
              <dl className="review-lines">
                <dt>Question <span className="hint">{clock(second)}, {str(point.kind) || 'reflection'}</span></dt>
                <dd data-testid="review-prompt">{str(point.prompt)}</dd>
                {options.length ? <><dt>Options</dt><dd><ul className="review-options">{options.map((option) => <li key={option}>{option}</li>)}</ul></dd></> : null}
                {str(point.draftNote) ? <><dt>Why it was drafted here</dt><dd className="hint">{str(point.draftNote)}</dd></> : null}
              </dl>
              <div className="actions review-decide">
                <Decision action="popup-review" idName="point" id={Number(point.id)} decision="approve" label="Approve and publish" keyName="a" tone="teal" next={following} testId="review-approve" />
                {tier ? <Link className="btn ghost" href={`/master/tiers/${tier.id}`} data-key="e" data-testid="review-adjust">Adjust <kbd>E</kbd></Link> : null}
                <Decision action="popup-review" idName="point" id={Number(point.id)} decision="reject" label="Reject" keyName="r" tone="ghost" next={following} testId="review-reject" />
                {status !== 'draft' ? <Decision action="popup-review" idName="point" id={Number(point.id)} decision="reopen" label="Back to waiting" keyName="u" tone="ghost" next={`/master/review/popups?point=${point.id}`} testId="review-reopen" /> : null}
              </div>
              <Stepper index={index} total={sorted.length} prev={href(index - 1)} next={href(index + 1)} />
              <Shortcuts extra="P plays the lead-in" />
            </div>
          </div>
        </section>
      ) : (
        <p className="empty">No pop-ups to review.</p>
      )}
    </Frame>
  )
}
