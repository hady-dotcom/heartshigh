import Link from 'next/link'
import type { Payload } from 'payload'
import type { ReactNode } from 'react'
import { Hidden } from '@/components/app/shell'
import { Simulator } from '@/components/desk/simulator'
import { sceneProblems } from '@/collections-opening'
import { idOf } from '@/lib/ids'
import { SCALES } from '@/lib/opening-data'
import { TRENDS_MIN, trendsFrom, type Contribution } from '@/lib/trends'
import { loadPersonaLens } from '@/server/persona'
import { loadPortal, type SessionUser } from '@/server/context'
import { loadOpening } from '@/server/opening'
import { partTitle } from '@/lib/talk-title'
import { portalDisplayName, showPortalName } from '@/lib/portal-name'
import { HelpTip } from '@/components/desk/help'
import { TOOL } from '@/lib/desk-help'
import { type Ctx, ref, rows, str } from '../common'
import { masterFlags } from '../app/journey'
import { AdminFrame } from './overview'
import { DeskFrame, masterNav } from './shell'

type MasterCtx = { payload: Payload; user: SessionUser; query: Record<string, string | undefined> }
type Option = { key?: string; label?: string; replyPill?: string; nudges?: { scale?: string; delta?: number }[]; intentLane?: unknown; spineFirst?: boolean; crisis?: boolean; sensitivity?: string }


function Frame({ ctx, active, title, intro, children, testId }: { ctx: MasterCtx; active: string; title: string; intro?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={title} intro={intro} active={active} nav={masterNav()} brand="Hady Core" subBrand="Master desk" brandHref="/master" query={ctx.query} testId={testId}>
      {children}
    </DeskFrame>
  )
}

const scaleName = (key?: string) => SCALES.find((scale) => scale.key === key)?.leonName || key || ''
const plainCaption = (text: string) => text.replace(/\*\*/g, '')

export async function MasterOpening(ctx: MasterCtx) {
  const { payload } = ctx
  const [scenes, lanes, flags] = await Promise.all([rows(payload, 'opening-scenes', undefined, { sort: 'order', limit: 50 }), rows(payload, 'lanes', undefined, { limit: 50 }), masterFlags(payload)])
  const problems = await Promise.all(scenes.map((scene) => sceneProblems(payload as never, { ...(scene as Record<string, unknown>), status: 'published' } as never)))
  const laneTitle = (value: unknown) => str(lanes.find((lane) => lane.id === idOf(value))?.title)
  return (
    <Frame ctx={ctx} active="opening" title="Opening scenes" intro="The six scenes a newcomer meets before the feed. Each tap nudges the heart scales a little and may name a lane. Publishing checks the rules: four to six options, no words on the kill list, one crisis option across all scenes, and no nudges on scales that are not read at first open." testId="master-opening">
      <section className="panel" style={{ marginBottom: 18 }} data-testid="player-flags">
        <header className="light"><h2>Player layout</h2><span className="hint">Applies to every portal</span></header>
        <form className="body form" action="/api/hearts" method="post">
          <Hidden fields={{ action: 'master-flags', next: '/master/opening' }} />
          <label className="check"><input type="checkbox" name="popupOverPlayer" defaultChecked={flags.popupOverPlayer} data-testid="flag-popup" /> Pop-up questions sit over the player. Off keeps the paused player fully in view, as YouTube’s embed rules ask.</label>
          <label className="check"><input type="checkbox" name="chromeOverPlayer" defaultChecked={flags.chromeOverPlayer} data-testid="flag-chrome" /> Caption, side buttons and speaker bar sit over the clip. Off places them around the player.</label>
          <div className="actions"><button className="btn ink small" type="submit" data-testid="flags-save">Save layout</button></div>
        </form>
      </section>
      {scenes.map((scene, index) => {
        const options = (scene.options as Option[]) || []
        return (
          <section className="panel" key={scene.id} style={{ marginBottom: 18 }} data-testid="scene-panel" data-scene={str(scene.key)}>
            <header className="light">
              <div><h2>{str(scene.order)}. {plainCaption(str(scene.caption))}</h2><p>{str(scene.key)} · {str(scene.layout)} · version {str(scene.version) || '1'}</p></div>
              <span className={`badge ${scene.status === 'published' ? 'teal' : 'grey'}`}>{scene.status === 'published' ? 'Published' : 'Draft'}</span>
            </header>
            <form action="/api/hearts/persona" method="post">
              <Hidden fields={{ action: 'nudges', scene: scene.id, next: '/master/opening' }} />
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Option</th><th>Reply</th><th>Nudges</th><th>Intent lane</th><th>Flags</th></tr></thead>
                  <tbody>
                    {options.map((option) => (
                      <tr key={option.key} data-testid="scene-option">
                        <td><b>{option.label}</b><div className="hint">{option.key}</div></td>
                        <td>{option.replyPill || ''}</td>
                        <td>
                          {(option.nudges || []).length ? (option.nudges || []).map((row) => (
                            <label key={`${option.key}-${row.scale}`} className="stack" style={{ marginBottom: 6 }}>
                              {scaleName(row.scale)}
                              <select name={`d__${option.key}__${row.scale}`} defaultValue={String(row.delta ?? 0)} data-testid="nudge" data-option={option.key} data-scale={row.scale}>
                                <option value="-1">−1</option>
                                <option value="0">0</option>
                                <option value="1">+1</option>
                              </select>
                            </label>
                          )) : <span className="hint">None</span>}
                        </td>
                        <td>{laneTitle(option.intentLane)}</td>
                        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {option.crisis ? <span className="badge rose">Help screen</span> : null}
                          {option.spineFirst ? <span className="badge purple">Spine first</span> : null}
                          {option.sensitivity === 'private' ? <span className="badge ink" data-testid="private-option">Private</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="body actions" style={{ paddingTop: 0 }}><button className="btn ghost small" type="submit" data-testid="nudges-save">Save nudges</button></div>
            </form>
            <form className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'scene-wording', scene: scene.id, next: '/master/opening' }} />
              <div className="cols">
                <label className="stack">Caption<input type="text" name="caption" defaultValue={str(scene.caption)} data-testid="scene-caption" /></label>
                <label className="stack">Second line<input type="text" name="subline" defaultValue={str(scene.subline)} /></label>
                <label className="stack">This month’s caption<input type="text" name="monthCaption" defaultValue={str(scene.monthCaption)} data-testid="month-caption" /></label>
                <label className="stack">This month’s second line<input type="text" name="monthSubline" defaultValue={str(scene.monthSubline)} /></label>
              </div>
              {problems[index].length ? (
                <ul className="hint" data-testid="scene-problems" style={{ color: '#a3324a', margin: 0 }}>{problems[index].map((problem) => <li key={problem}>{problem}</li>)}</ul>
              ) : <p className="hint" style={{ margin: 0 }}>Ready to publish.</p>}
              <div className="actions">
                <select name="status" defaultValue={str(scene.status) || 'draft'}><option value="draft">Draft</option><option value="published">Published</option></select>
                <button className="btn ink small" type="submit" data-testid="scene-save">Save scene</button>
                <Link className="btn ghost small" href={`/admin/collections/opening-scenes/${scene.id}`}>Options and nudges</Link>
              </div>
            </form>
          </section>
        )
      })}
    </Frame>
  )
}

export async function MasterLanes(ctx: MasterCtx) {
  const { payload } = ctx
  const [lanes, tags, lessons, scales] = await Promise.all([
    rows(payload, 'lanes', undefined, { sort: 'order', limit: 50 }),
    rows(payload, 'tags', { lane: { exists: true } }, { depth: 1, limit: 2000 }),
    rows(payload, 'lessons', undefined, { limit: 2000 }),
    rows(payload, 'heart-scales', undefined, { limit: 20 }),
  ])
  const queue = tags.filter((tag) => tag.state !== 'confirmed')
  const titleOf = (tag: Record<string, unknown>) => {
    const item = tag.item as { relationTo?: string; value?: Record<string, unknown> | number } | null
    const doc = item && typeof item.value === 'object' ? item.value : null
    if (!doc) return 'A clip'
    if (item?.relationTo === 'lessons') return str(doc.title)
    const lesson = lessons.find((row) => row.id === idOf(doc.lesson))
    const start = Number(doc.start || 0)
    return `${partTitle(lesson)} at ${Math.floor(start / 60)}:${String(Math.floor(start % 60)).padStart(2, '0')}`
  }
  const laneTitle = (value: unknown) => str(lanes.find((lane) => lane.id === idOf(value))?.title)
  return (
    <Frame ctx={ctx} active="lanes" title="Lanes" intro="A lane is a thread of clips for one part of the heart. A clip is routed in a lane only once its tag is confirmed here." testId="master-lanes">
      <section className="panel" style={{ marginBottom: 18 }} data-testid="tag-queue">
        <header className="light"><h2>Waiting for a lane ({queue.length})</h2><span className="hint">Suggested by the extractor or an author</span></header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Clip</th><th>Suggested lane</th><th className="num">Weight</th><th>Note</th><th /></tr></thead>
            <tbody>
              {queue.map((tag) => (
                <tr key={tag.id} data-testid="queue-row">
                  <td><b>{titleOf(tag)}</b></td>
                  <td>{laneTitle(tag.lane)}</td>
                  <td className="num">{Number(tag.weight ?? 1).toFixed(1)}</td>
                  <td className="hint">{str(tag.note)}</td>
                  <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <form action="/api/hearts" method="post"><Hidden fields={{ action: 'lane-tag', tag: tag.id, decision: 'confirm', next: '/master/lanes' }} /><button className="btn teal small" type="submit" data-testid="tag-confirm">Confirm</button></form>
                    <form action="/api/hearts" method="post"><Hidden fields={{ action: 'lane-tag', tag: tag.id, decision: 'reject', next: '/master/lanes' }} /><button className="btn ghost small" type="submit" data-testid="tag-reject">Not this lane</button></form>
                  </td>
                </tr>
              ))}
              {!queue.length ? <tr><td colSpan={5} className="empty">Nothing waiting. Every suggested lane has been looked at.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Lane</th><th>Scale</th><th>Fit</th><th className="num">Starters</th><th className="num">Confirmed clips</th><th>Who sees it</th></tr></thead>
            <tbody>
              {lanes.map((lane) => (
                <tr key={lane.id} data-testid="lane-row" data-lane={str(lane.key)}>
                  <td><b>{str(lane.title)}</b><div className="hint">{str(lane.key)}</div></td>
                  <td>{str(scales.find((scale) => scale.id === ref(lane.scale))?.leonName)}</td>
                  <td>{str(lane.fit)}</td>
                  <td className="num">{((lane.starters as unknown[]) || []).length}</td>
                  <td className="num">{tags.filter((tag) => idOf(tag.lane) === lane.id && tag.state === 'confirmed').length}</td>
                  <td>{lane.pseudo ? <span className="badge grey">Default, never scored</span> : lane.optInOnly ? <span className="badge ink">Only after opting in</span> : <span className="badge teal">Everyone</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Frame>
  )
}

function TrendsTable({ trends, laneTitles }: { trends: ReturnType<typeof trendsFrom>; laneTitles: Record<string, string> }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr><th>Week</th><th className="num">People</th><th>Doors chosen</th><th>Lanes most often first or second</th><th>Scenes passed</th></tr></thead>
        <tbody>
          {trends.map((row) => (
            <tr key={row.week} data-testid="trend-row" data-shown={row.shown ? 'yes' : 'no'}>
              <td>{row.week}</td>
              <td className="num">{row.shown ? row.people : `fewer than ${TRENDS_MIN}`}</td>
              {row.shown ? (
                <>
                  <td>{row.doors.slice(0, 4).map(([key, n]) => `${key} ${n}`).join(', ')}</td>
                  <td>{row.lanes.slice(0, 4).map(([key, n]) => `${laneTitles[key] || key} ${n}`).join(', ')}</td>
                  <td>{row.passes.slice(0, 3).map(([key, n]) => `${key} ${n}`).join(', ') || 'None'}</td>
                </>
              ) : <td colSpan={3} className="hint">Held back until at least {TRENDS_MIN} people have taken part, so nobody can be picked out.</td>}
            </tr>
          ))}
          {!trends.length ? <tr><td colSpan={5} className="empty">No one has added their taps yet. It is off unless a learner turns it on.</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
}

async function contributions(payload: Payload) {
  return (await payload.find({ collection: 'heart-contributions', overrideAccess: true, depth: 0, limit: 5000, pagination: false })).docs as unknown as Contribution[]
}

async function laneTitleMap(payload: Payload) {
  return Object.fromEntries((await rows(payload, 'lanes', undefined, { limit: 50 })).map((lane) => [str(lane.key), str(lane.title)]))
}

export async function MasterTrends(ctx: MasterCtx) {
  const { payload } = ctx
  const [all, portals, laneTitles, lens] = await Promise.all([contributions(payload), rows(payload, 'portals', undefined, { sort: 'name' }), laneTitleMap(payload), loadPersonaLens(payload)])
  const bandTitle = Object.fromEntries(lens.bands.map((band) => [band.key, band.title]))
  return (
    <Frame ctx={ctx} active="trends" title="Network trends" intro={`Counts from learners who chose to add their taps. No names, no answers to private scenes, and nothing shown for a group under ${TRENDS_MIN}.`} testId="master-trends">
      <section className="panel" style={{ marginBottom: 18 }} data-testid="persona-lens">
        <header className="light"><h2>Persona lens</h2><span className="badge grey">Staff only</span></header>
        <div className="body">
          <p style={{ marginTop: 0 }}>Balanced ranges, still editable. It counts people in a portal and never names them. Portal desks do not see it. {lens.published} of {lens.bands.length} bands are published.</p>
          {lens.published === 0 ? <p data-testid="persona-held">Nothing is counted yet. Every band is still a draft.</p> : null}
          {lens.tallies.map((cell) => (
            <p key={`${cell.group}-${cell.persona}`} data-testid="persona-cell" data-shown={cell.shown ? 'yes' : 'no'}>
              {cell.shown ? `${bandTitle[cell.persona] || cell.persona} in ${cell.group}: ${cell.share}%` : 'Not enough people yet'}
            </p>
          ))}
          <p className="hint" style={{ marginBottom: 0 }}><a href="/master/personas">Edit the bands</a></p>
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }}>
        <header className="light"><h2>Every portal</h2></header>
        <TrendsTable trends={trendsFrom(all)} laneTitles={laneTitles} />
      </section>
      {portals.map((portal) => (
        <section className="panel" key={portal.id} style={{ marginBottom: 18 }}>
          <header className="light"><h2>{portalDisplayName(portal)}</h2></header>
          <TrendsTable trends={trendsFrom(all, portal.id)} laneTitles={laneTitles} />
        </section>
      ))}
    </Frame>
  )
}

export async function MasterSimulator(ctx: MasterCtx) {
  const { payload, query } = ctx
  const portals = await rows(payload, 'portals', undefined, { sort: 'name' })
  const slug = query.portal || str(portals[0]?.slug)
  const portal = slug ? await loadPortal(payload, slug) : null
  if (!portal) return <Frame ctx={ctx} active="simulator" title="Simulator"><p>Open a portal first.</p></Frame>
  const opening = await loadOpening(payload, portal, null)
  const [cuts, lessons] = await Promise.all([rows(payload, 'cuts', { id: { in: opening.route.cuts.map((cut) => cut.id) } }, { limit: 2000 }), rows(payload, 'lessons', undefined, { limit: 2000 })])
  const cutTitles = Object.fromEntries(cuts.map((cut) => {
    const lesson = lessons.find((row) => row.id === idOf(cut.lesson))
    return [cut.id, lesson ? partTitle(lesson) : `Clip ${cut.id}`]
  }))
  const scaleNames = Object.fromEntries(SCALES.map((scale) => [scale.key, scale.leonName]))
  return (
    <Frame ctx={ctx} active="simulator" title="Simulator" intro="Pick a tap for each scene and see what the phone would work out: the scales, the lane scores and the first feed. It runs the same code as the app and keeps nothing." testId="master-simulator">
      <form className="actions" style={{ marginBottom: 14 }}>
        <label>Portal <select name="portal" defaultValue={slug}>{portals.map((row) => <option key={row.id} value={str(row.slug)}>{str(row.name)}</option>)}</select></label>
        <button className="btn ghost small" type="submit">Use this portal</button>
      </form>
      <Simulator scenes={opening.scenes} scales={opening.scales} route={opening.route} scaleNames={scaleNames} cutTitles={cutTitles} />
    </Frame>
  )
}

export async function PortalOpeningScreen(ctx: Ctx) {
  const { payload, portal, base } = ctx
  const here = `${base}/admin/opening`
  const [scenes, configRows, all, laneTitles] = await Promise.all([
    rows(payload, 'opening-scenes', { status: { equals: 'published' } }, { sort: 'order', limit: 20 }),
    rows(payload, 'opening-configs', { portal: { equals: portal.id } }, { limit: 1 }),
    contributions(payload),
    laneTitleMap(payload),
  ])
  const config = configRows[0]
  const wording = (config?.wording as { scene?: unknown; caption?: string; subline?: string }[]) || []
  const hidden = new Set(((config?.hiddenScenes as unknown[]) || []).map((row) => idOf(row)))
  const contacts = (config?.helpContacts as { label?: string; phone?: string; url?: string; hours?: string }[]) || []
  return (
    <AdminFrame ctx={ctx} active="opening" title="Opening" intro="The scenes a newcomer sees before the feed. You can change the words for your community or leave a scene out. The options and what they mean stay as the master desk set them." testId="admin-opening">
      {scenes.map((scene) => {
        const own = wording.find((row) => idOf(row.scene) === scene.id)
        const crisis = ((scene.options as Option[]) || []).some((option) => option.crisis)
        return (
          <section className="panel" key={scene.id} style={{ marginBottom: 18 }} data-testid="portal-scene" data-scene={str(scene.key)}>
            <header className="light">
              <div><h2>{str(scene.order)}. {plainCaption(own?.caption || str(scene.caption))}</h2><p>{((scene.options as Option[]) || []).map((option) => option.label).join(' · ')}</p></div>
              {hidden.has(scene.id) ? <span className="badge grey">Left out</span> : own ? <span className="badge purple">Your wording</span> : null}
            </header>
            <form className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'opening-config', portalSlug: portal.slug, scene: scene.id, next: here }} />
              <div className="cols">
                <label className="stack">Caption<input type="text" name="caption" defaultValue={own?.caption || ''} placeholder={str(scene.caption)} data-testid="portal-caption" /></label>
                <label className="stack">Second line<input type="text" name="subline" defaultValue={own?.subline || ''} placeholder={str(scene.subline)} /></label>
              </div>
              {crisis ? <p className="hint" style={{ margin: 0 }}>This scene holds the option that opens the help screen, so it is always shown.</p> : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="check"><input type="checkbox" name="hidden" defaultChecked={hidden.has(scene.id)} data-testid="portal-hide" /> Leave this scene out for {showPortalName(portal.name)}</label>
                  <HelpTip topic="hide-scene">{TOOL.hideScene}</HelpTip>
                </span>
              )}
              <div className="actions"><button className="btn ink small" type="submit" data-testid="portal-scene-save">Save</button></div>
            </form>
          </section>
        )
      })}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <section className="panel" data-testid="help-contacts">
          <header className="light"><h2>Help contacts <HelpTip topic="help-contacts">{TOOL.helpContacts}</HelpTip></h2><span className="hint">Shown on the help screen</span></header>
          <div className="body" style={{ display: 'grid', gap: 10 }}>
            {contacts.map((contact, index) => (
              <div className="count-tile" key={`${contact.label}-${index}`} data-testid="help-contact">
                <span>{contact.label}<span className="hint" style={{ display: 'block', fontWeight: 500 }}>{[contact.phone, contact.url, contact.hours].filter(Boolean).join(' · ')}</span></span>
                <form action="/api/hearts" method="post"><Hidden fields={{ action: 'help-contact-remove', portalSlug: portal.slug, index, next: here }} /><button className="btn ghost small" type="submit">Remove</button></form>
              </div>
            ))}
            {!contacts.length ? <p className="hint">None of your own yet, so the national lines are shown.</p> : null}
            <form className="form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'help-contact', portalSlug: portal.slug, next: here }} />
              <div className="cols">
                <label className="stack">Name<input type="text" name="label" data-testid="contact-label" /></label>
                <label className="stack">Phone<input type="text" name="phone" data-testid="contact-phone" /></label>
                <label className="stack">Link<input type="text" name="url" /></label>
                <label className="stack">Hours<input type="text" name="hours" /></label>
              </div>
              <div className="actions"><button className="btn ink small" type="submit" data-testid="contact-save">Add contact</button></div>
            </form>
          </div>
        </section>
        <section className="panel" data-testid="portal-trends">
          <header className="light"><h2>Trends in {showPortalName(portal.name)}</h2></header>
          <TrendsTable trends={trendsFrom(all, portal.id)} laneTitles={laneTitles} />
        </section>
      </div>
    </AdminFrame>
  )
}
