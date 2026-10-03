'use client'

import { useMemo, useState } from 'react'

/** A sentence of the talk, with where a clip may open before it and close after it. */
type Line = { start: number; end: number; text: string; inAt: number; outAt: number }
type Tier = {
  id: number
  horsStart: number
  horsEnd: number
  appetiserStart: number
  appetiserEnd: number
  horsQuote: string
  hook: string
  turn: string
  land: string
  offerResume: boolean
  note: string
  checked: boolean
}

const HORS_MIN = 15
const HORS_MAX = 20
const APPETISER_MAX = 180

function clock(total: number) {
  const seconds = Math.max(0, Math.round(total))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

const seconds = (value: number) => `${Math.round(value * 10) / 10} s`

function Scrub({ label, name, value, max, onChange, testId }: { label: string; name: string; value: number; max: number; onChange: (value: number) => void; testId: string }) {
  return (
    <div className="tier-scrub" data-testid={testId}>
      <label className="tier-scrub-label" htmlFor={`${testId}-seconds`}>
        <b>{label}</b>
        <span className="hint">{clock(value)}</span>
      </label>
      <input id={`${testId}-seconds`} type="number" name={name} min={0} max={max} step="any" value={value} onChange={(event) => onChange(Math.max(0, Math.min(max, Number(event.target.value) || 0)))} data-testid={`${testId}-seconds`} />
      <input type="range" min={0} max={max} step={0.1} value={value} aria-label={`${label}, scrub`} onChange={(event) => onChange(Number(event.target.value))} data-testid={`${testId}-range`} />
    </div>
  )
}

/** The in and out points of one talk's hors d'oeuvre and appetiser, with a preview and the caption lines to choose hook, turn and land from. */
export function TierEditor({ tier, youtubeId, duration, lines, next, horsMax = 45 }: { tier: Tier; youtubeId: string | null; duration: number; lines: Line[]; next: string; horsMax?: number }) {
  const max = Math.max(1, Math.ceil(duration || Math.max(tier.appetiserEnd, tier.horsEnd) + 60))
  const [hs, setHs] = useState(tier.horsStart)
  const [he, setHe] = useState(tier.horsEnd)
  const [as, setAs] = useState(tier.appetiserStart)
  const [ae, setAe] = useState(tier.appetiserEnd)
  const [text, setText] = useState({ horsQuote: tier.horsQuote, hook: tier.hook, turn: tier.turn, land: tier.land })
  const [preview, setPreview] = useState<{ start: number; end: number; nonce: number } | null>(null)
  const [near, setNear] = useState(true)

  const horsLength = he - hs
  const appetiserLength = ae - as
  const warnings = [
    horsLength < HORS_MIN ? `The hors d'oeuvre runs ${seconds(horsLength)}. Keep it at least ${HORS_MIN} seconds.` : null,
    horsLength > horsMax ? `The hors d'oeuvre runs ${seconds(horsLength)}. Keep it to ${horsMax} seconds.` : horsLength > HORS_MAX ? `The hors d'oeuvre runs ${seconds(horsLength)}. The usual length is between ${HORS_MIN} and ${HORS_MAX} seconds. Up to ${horsMax} seconds is allowed.` : null,
    appetiserLength <= 0 ? 'The appetiser has to end after it starts.' : appetiserLength > APPETISER_MAX + 15 ? `The appetiser runs ${clock(appetiserLength)}. Keep it to about 3 minutes.` : null,
    duration && (he > duration || ae > duration) ? `An out point is after the end of the talk (${clock(duration)}).` : null,
  ].filter((value): value is string => Boolean(value))

  const shown = useMemo(() => (near ? lines.filter((line) => line.end >= Math.min(hs, as) - 20 && line.start <= Math.max(he, ae) + 20) : lines), [lines, near, hs, he, as, ae])
  const play = (start: number, end: number) => setPreview({ start: Math.floor(start), end: Math.ceil(end), nonce: Date.now() })
  const round = (value: number) => Math.round(value * 100) / 100
  const field = (key: keyof typeof text) => ({ name: key, value: text[key], onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setText({ ...text, [key]: event.target.value }) })

  return (
    <form className="tier-editor" action="/api/hearts" method="post" data-testid="tier-editor">
      <input type="hidden" name="action" value="tier-save" />
      <input type="hidden" name="tier" value={tier.id} />
      <input type="hidden" name="next" value={next} />
      <div className="tier-grid">
        <section className="panel">
          <header className="light"><h2>Preview</h2><span className="hint">{duration ? `Talk length ${clock(duration)}` : 'Length not known'}</span></header>
          <div className="body">
            <div className="tier-player" data-testid="tier-player">
              {youtubeId && preview ? (
                <iframe
                  key={preview.nonce}
                  title="Preview"
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId}?start=${preview.start}&end=${preview.end}&autoplay=1&playsinline=1&rel=0&cc_load_policy=1&cc_lang_pref=en`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  data-testid="tier-preview-frame"
                  data-start={preview.start}
                  data-end={preview.end}
                />
              ) : (
                <p className="hint">{youtubeId ? 'Choose what to preview. It plays from the in point and stops at the out point.' : 'This talk has no film link, so it cannot be previewed here.'}</p>
              )}
            </div>
            <div className="actions">
              <button type="button" className="btn ghost small" onClick={() => play(hs, he)} disabled={!youtubeId} data-testid="preview-hors">Preview hors d&apos;oeuvre</button>
              <button type="button" className="btn ghost small" onClick={() => play(as, ae)} disabled={!youtubeId} data-testid="preview-appetiser">Preview appetiser</button>
              <button type="button" className="btn ghost small" onClick={() => play(Math.max(0, ae - 8), ae + 12)} disabled={!youtubeId} data-testid="preview-resume">Hear the resume point</button>
            </div>
          </div>
        </section>
        <section className="panel">
          <header className="light"><h2>In and out points</h2><span className={`badge ${tier.checked ? 'teal' : 'grey'}`}>{tier.checked ? 'Checked' : 'Draft, needs a human check'}</span></header>
          <div className="body form">
            <h3 className="tier-h">Hors d&apos;oeuvre <span className="hint">{seconds(horsLength)}</span></h3>
            <Scrub label="In" name="horsStart" value={hs} max={max} onChange={setHs} testId="hors-start" />
            <Scrub label="Out" name="horsEnd" value={he} max={max} onChange={setHe} testId="hors-end" />
            <h3 className="tier-h">Appetiser <span className="hint">{clock(appetiserLength)}</span></h3>
            <Scrub label="In" name="appetiserStart" value={as} max={max} onChange={setAs} testId="appetiser-start" />
            <Scrub label="Out" name="appetiserEnd" value={ae} max={max} onChange={setAe} testId="appetiser-end" />
            <p className="hint tier-note">The main always opens at 0:00. The appetiser stops at its out point. In and out points sit in the pause between sentences: use the In and Out buttons beside each caption line.</p>
            <label className="check"><input type="checkbox" name="offerResume" defaultChecked={tier.offerResume} data-testid="tier-offer-resume" /> Offer &quot;Resume from where the appetiser ended&quot; next to the main</label>
            {warnings.length ? <ul className="hint tier-warn" data-testid="tier-warnings">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="hint" style={{ margin: 0 }} data-testid="tier-ok">Both tiers are within their lengths.</p>}
          </div>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 18 }}>
        <header className="light"><h2>Hook, turn and land</h2><span className="hint">Word for word from the talk</span></header>
        <div className="body form">
          <label className="stack">Hook<textarea rows={2} {...field('hook')} data-testid="tier-hook" /></label>
          <label className="stack">Turn<textarea rows={2} {...field('turn')} data-testid="tier-turn" /></label>
          <label className="stack">Land<textarea rows={2} {...field('land')} data-testid="tier-land" /></label>
          <label className="stack">Line shown with the hors d&apos;oeuvre<textarea rows={2} {...field('horsQuote')} data-testid="tier-hors-quote" /></label>
          <label className="stack">Note<textarea name="note" rows={2} defaultValue={tier.note} data-testid="tier-note" /></label>
          <div className="actions">
            <button className="btn ink small" type="submit" data-testid="tier-save">Save</button>
            {tier.checked ? (
              <button className="btn ghost small" type="submit" name="reopen" value="yes" data-testid="tier-reopen">Save and mark as a draft again</button>
            ) : (
              <button className="btn teal small" type="submit" name="check" value="yes" data-testid="tier-check">Save and mark as checked</button>
            )}
          </div>
        </div>
      </section>
      <section className="panel" style={{ marginTop: 18 }} data-testid="tier-lines">
        <header className="light">
          <h2>Caption lines</h2>
          <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={near} onChange={(event) => setNear(event.target.checked)} /> Only near the tiers</label>
        </header>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Time</th><th>Line</th><th /></tr></thead>
            <tbody>
              {shown.map((line) => (
                <tr key={`${line.start}-${line.text.slice(0, 12)}`} data-testid="tier-line" data-inside={line.start >= as && line.end <= ae ? 'yes' : 'no'}>
                  <td className="num"><button type="button" className="link-btn" onClick={() => play(line.start, line.end + 1)} disabled={!youtubeId}>{clock(line.start)}</button></td>
                  <td>{line.text}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {(['hook', 'turn', 'land'] as const).map((key) => (
                      <button key={key} type="button" className="btn ghost small" onClick={() => setText({ ...text, [key]: line.text })} data-testid={`use-${key}`}>{key[0].toUpperCase() + key.slice(1)}</button>
                    ))}
                    <button type="button" className="btn ghost small" onClick={() => setHs(round(line.inAt))} data-testid="use-hors-in">Hors in</button>
                    <button type="button" className="btn ghost small" onClick={() => setHe(round(line.outAt))} data-testid="use-hors-out">Hors out</button>
                    <button type="button" className="btn ghost small" onClick={() => setAs(round(line.inAt))} data-testid="use-in">In</button>
                    <button type="button" className="btn ghost small" onClick={() => setAe(round(line.outAt))} data-testid="use-out">Out</button>
                  </td>
                </tr>
              ))}
              {!shown.length ? <tr><td colSpan={3} className="empty">No caption lines here.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </form>
  )
}
