import type { Payload } from 'payload'
import type { ReactNode } from 'react'
import { Hidden } from '@/components/app/shell'
import { BALANCE_NOTES } from '@/lib/persona-data'
import { publishProblems, sameRangeAs, bandFromRow, type PersonaBand } from '@/lib/persona'
import { SCALE_KEYS } from '@/lib/heart'
import type { SessionUser } from '@/server/context'
import { rows, str } from '../common'
import { DeskFrame, masterNav } from './shell'

type MasterCtx = { payload: Payload; user: SessionUser; query: Record<string, string | undefined> }

const ROOMS = [
  ['appetites', 'Appetites'],
  ['heat', 'Heat'],
  ['unsettled', 'Unsettled'],
  ['lights', 'Lights'],
] as const

const SEASONS = [
  ['youth', 'Youth'],
  ['health', 'Health'],
  ['wealth', 'Wealth'],
  ['freeTime', 'Free time'],
  ['life', 'Life'],
] as const

const SOURCES = [
  ['unassigned', 'Not assigned'],
  ['doc-a', 'Doc A'],
  ['doc-b', 'Doc B'],
  ['doc-c', 'Doc C (incomplete)'],
  ['ux-draft', 'UX draft'],
  ['balanced', 'Balanced reading'],
] as const

function Frame({ ctx, title, intro, children }: { ctx: MasterCtx; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <DeskFrame payload={ctx.payload} user={ctx.user} title={title} intro={intro} active="personas" nav={masterNav()} brand="HEARTS" subBrand="Master desk" brandHref="/master" query={ctx.query} testId="master-personas">
      {children}
    </DeskFrame>
  )
}

function formatAnchors(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  return Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([rung, text]) => `${rung}: ${text}`)
    .join('\n')
}

export async function MasterPersonas(ctx: MasterCtx) {
  const { payload } = ctx
  const [scaleRows, bandRows, copyRows] = await Promise.all([
    rows(payload, 'heart-scales', undefined, { limit: 20 }),
    rows(payload, 'persona-bands', undefined, { sort: 'title', limit: 50 }),
    rows(payload, 'compass-settings', { key: { equals: 'default' } }, { limit: 1 }),
  ])
  const copy = copyRows[0]
  const bands = bandRows.map((row) => ({ id: row.id, band: bandFromRow(row as unknown as Parameters<typeof bandFromRow>[0]) }))
  const order = new Map(SCALE_KEYS.map((key, index) => [key, index]))
  scaleRows.sort((a, b) => (order.get(str(a.key) as never) ?? 99) - (order.get(str(b.key) as never) ?? 99))
  const nameOf = (key: string) => str(scaleRows.find((scale) => scale.key === key)?.leonName) || key
  return (
    <Frame ctx={ctx} title="Scales and persona bands" intro="Scales are the ten readings the opening nudges. Persona bands are a balanced reading, editable here, and they never choose a learner’s clips. Learners see only the warm words below.">
      <section className="panel" style={{ marginBottom: 18 }} data-testid="persona-questions">
        <header className="light"><h2>Balancing choices</h2><span className="hint">Distinct ranges, still editable</span></header>
        <div className="body">
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            {BALANCE_NOTES.map((item) => <li key={item.id} data-testid={`balance-${item.id}`}>{item.text}</li>)}
          </ol>
        </div>
      </section>
      {copy ? <CopyEditor copy={copy} /> : null}

      <section className="panel" style={{ marginBottom: 18 }} data-testid="scale-list">
        <header className="light"><h2>Heart scales</h2><span className="hint">Season is blank until the pairing table is in</span></header>
        <div className="body" style={{ display: 'grid', gap: 16 }}>
          {scaleRows.map((scale) => (
            <form key={scale.id} className="form" action="/api/hearts/persona" method="post" data-testid="scale-editor" data-scale={str(scale.key)} style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <Hidden fields={{ action: 'scale', scale: scale.id, next: '/master/personas' }} />
              <div className="cols">
                <label className="stack">Name used on this desk<input type="text" name="leonName" defaultValue={str(scale.leonName)} /></label>
                <label className="stack">Learner-safe name<input type="text" name="polishLabel" defaultValue={str(scale.polishLabel)} data-testid="polish-label" /></label>
                <label className="stack">Focus word<input type="text" name="focusName" defaultValue={str(scale.focusName)} data-testid="focus-name" /></label>
                <label className="stack">Room
                  <select name="room" defaultValue={str(scale.room)}>
                    <option value="">Not set</option>
                    {ROOMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="stack">Season
                  <select name="season" defaultValue={str(scale.season)} data-testid="scale-season">
                    <option value="">Not set</option>
                    {SEASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <label className="check"><input type="checkbox" name="firstOpenRead" defaultChecked={scale.firstOpenRead !== false} data-testid="first-open-read" /> Read this scale during the opening</label>
              <label className="stack">Anchors, one rung a line<textarea name="anchors" rows={Math.min(6, Math.max(2, formatAnchors(scale.anchors).split('\n').filter(Boolean).length || 2))} defaultValue={formatAnchors(scale.anchors)} data-testid="scale-anchors" /></label>
              <div className="actions"><button className="btn ink small" type="submit" data-testid="scale-save">Save scale</button></div>
            </form>
          ))}
        </div>
      </section>

      {bands.map(({ id, band }) => <BandEditor key={id} id={id} band={band} bands={bands.map((item) => item.band)} nameOf={nameOf} />)}
    </Frame>
  )
}

function CopyEditor({ copy }: { copy: Record<string, unknown> }) {
  const places = (copy.places as { key?: string; label?: string; low?: number; high?: number; forward?: string }[]) || []
  const place = (key: string) => places.find((row) => row.key === key)
  return (
    <section className="panel" style={{ marginBottom: 18 }} data-testid="compass-copy">
      <header className="light"><h2>Words a learner sees</h2><span className="hint">No numbers leave this form for them</span></header>
      <form className="body form" action="/api/hearts/persona" method="post">
        <Hidden fields={{ action: 'copy', next: '/master/personas' }} />
        <div className="cols">
          <label className="stack">Framing
            <select name="frame" defaultValue={str(copy.frame) || 'both'} data-testid="compass-frame">
              <option value="both">Place words and Focusing on</option>
              <option value="focusing">Focusing on only</option>
              <option value="places">Place words only</option>
            </select>
          </label>
          <label className="stack">Focus line<input type="text" name="focusLead" defaultValue={str(copy.focusLead)} data-testid="focus-lead" /></label>
        </div>
        {(['growing', 'steady', 'flourishing'] as const).map((key) => (
          <div key={key} className="cols">
            <label className="stack">{key}<input type="text" name={`label-${key}`} defaultValue={place(key)?.label || ''} data-testid={`place-${key}`} /></label>
            <label className="stack">From<input type="number" name={`low-${key}`} defaultValue={place(key)?.low ?? ''} /></label>
            <label className="stack">To<input type="number" name={`high-${key}`} defaultValue={place(key)?.high ?? ''} /></label>
            <label className="stack">Next step<input type="text" name={`forward-${key}`} defaultValue={place(key)?.forward || ''} /></label>
          </div>
        ))}
        <label className="stack">When it has moved on<input type="text" name="movementUp" defaultValue={str(copy.movementUp)} /></label>
        <label className="stack">When it is holding<input type="text" name="movementSame" defaultValue={str(copy.movementSame)} /></label>
        <label className="stack">When it wants more time<input type="text" name="movementOnward" defaultValue={str(copy.movementOnward)} /></label>
        <div className="actions"><button className="btn ink small" type="submit" data-testid="copy-save">Save wording</button></div>
      </form>
    </section>
  )
}

function BandEditor({ id, band, bands, nameOf }: { id: number; band: PersonaBand; bands: PersonaBand[]; nameOf: (key: string) => string }) {
  const problems = publishProblems(band, bands)
  const twin = sameRangeAs(band, bands)
  return (
    <section className="panel" style={{ marginBottom: 18 }} data-testid="persona-band" data-persona={band.key}>
      <header className="light">
        <div><h2>{band.title}</h2><p>{band.key}{band.identicalGroup ? ` · group ${band.identicalGroup}` : ''}</p></div>
        <span className={`badge ${band.status === 'published' ? 'teal' : 'grey'}`}>{band.status === 'published' ? 'Published' : 'Draft'}</span>
      </header>
      <form className="body form" action="/api/hearts/persona" method="post">
        <Hidden fields={{ action: 'band', band: id, next: '/master/personas' }} />
        {twin ? <p className="hint" data-testid="same-ranges">Same ranges as {twin.title}.</p> : null}
        <div className="cols">
          <label className="stack">Name on this desk<input type="text" name="title" defaultValue={band.title} /></label>
          <label className="stack">Source
            <select name="source" defaultValue={band.source}>
              {SOURCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="stack">Status
            <select name="status" defaultValue={band.status} data-testid="band-status">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
        <label className="check"><input type="checkbox" name="placeholder" defaultChecked={band.placeholder} data-testid="band-placeholder" /> Stand-in numbers, not yet Leon’s</label>
        <label className="stack">Note<textarea name="note" rows={3} defaultValue={band.note} /></label>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Scale</th><th>In the source</th><th className="num">Low</th><th className="num">High</th></tr></thead>
            <tbody>
              {band.ranges.map((row) => (
                <tr key={row.scale} data-testid="range-row" data-scale={row.scale} data-present={row.present ? 'yes' : 'no'}>
                  <td><b>{nameOf(row.scale)}</b><div className="hint">{row.scale}</div></td>
                  <td>
                    <label className="check"><input type="checkbox" name={`present-${row.scale}`} defaultChecked={row.present} /> {row.present ? 'Has a row' : 'No source row'}</label>
                  </td>
                  <td className="num"><input type="number" name={`min-${row.scale}`} min={-10} max={10} step={1} defaultValue={row.min ?? ''} style={{ width: 72 }} data-testid="range-min" /></td>
                  <td className="num"><input type="number" name={`max-${row.scale}`} min={-10} max={10} step={1} defaultValue={row.max ?? ''} style={{ width: 72 }} data-testid="range-max" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {problems.length ? (
          <ul className="hint" data-testid="band-problems" style={{ color: '#a3324a', margin: '8px 0 0' }}>{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
        ) : <p className="hint" style={{ margin: '8px 0 0' }}>Ready to publish.</p>}
        <div className="actions"><button className="btn ink small" type="submit" data-testid="band-save">Save band</button></div>
      </form>
    </section>
  )
}
