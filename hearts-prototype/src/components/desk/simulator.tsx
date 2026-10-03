'use client'

import { useMemo, useState } from 'react'
import { applyTap, freshState, pickSignals, routeFeed, type HeartState, type LaneDef, type CutInfo, type ScaleDef, type SceneDef } from '@/lib/heart'

type Props = {
  scenes: SceneDef[]
  scales: ScaleDef[]
  route: { lanes: LaneDef[]; cuts: CutInfo[]; d0CutId: number | null; allowSuggested: boolean; showUnchecked?: boolean }
  scaleNames: Record<string, string>
  cutTitles: Record<number, string>
}

/** Runs the same heart.ts the phones run, on taps the author picks. Nothing here is stored. */
export function Simulator({ scenes, scales, route, scaleNames, cutTitles }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [optIn, setOptIn] = useState<string[]>([])
  const ctx = useMemo(() => ({ ...route, scales, now: Date.UTC(2026, 9, 1) }), [route, scales])

  const result = useMemo(() => {
    let state: HeartState = { ...freshState('simulator', 1, ctx.now), optInLanes: optIn }
    let crisis = false
    for (const scene of scenes) {
      const pick = picks[scene.key]
      if (!pick) continue
      const outcome = applyTap(state, scene.key, pick, scenes, scales, ctx.now)
      state = outcome.state
      crisis ||= outcome.crisis
    }
    const feed = routeFeed(state, ctx)
    return { state, crisis, feed, signals: pickSignals(feed.scores) }
  }, [picks, optIn, scenes, scales, ctx])

  const laneTitle = (key: string | null) => (key ? route.lanes.find((lane) => lane.key === key)?.title || key : 'Spine')
  const optInLanes = route.lanes.filter((lane) => lane.optInOnly)

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', alignItems: 'start' }} data-testid="simulator">
      <section className="panel">
        <header className="light"><h2>Taps</h2></header>
        <div className="body form">
          {scenes.map((scene) => (
            <label className="stack" key={scene.key}>
              {scene.order}. {scene.caption.replace(/\*\*/g, '')}
              <select value={picks[scene.key] || ''} onChange={(event) => setPicks((value) => ({ ...value, [scene.key]: event.target.value }))} data-testid={`sim-${scene.key}`}>
                <option value="">Not reached</option>
                <option value="pass">Passed</option>
                {scene.options.map((option) => <option key={option.key} value={option.key}>{option.label}{option.crisis ? ' (help screen)' : ''}</option>)}
              </select>
            </label>
          ))}
          {optInLanes.map((lane) => (
            <label key={lane.key} className="check">
              <input type="checkbox" checked={optIn.includes(lane.key)} onChange={(event) => setOptIn((value) => (event.target.checked ? [...value, lane.key] : value.filter((key) => key !== lane.key)))} /> Learner has opted in to {lane.title}
            </label>
          ))}
          <div className="actions"><button type="button" className="btn ghost small" onClick={() => { setPicks({}); setOptIn([]) }}>Clear</button></div>
        </div>
      </section>
      <div style={{ display: 'grid', gap: 18 }}>
        {result.crisis ? <p className="flash error" data-testid="sim-crisis">This path opens the help screen before any clip.</p> : null}
        <section className="panel">
          <header className="light"><h2>Scales after these taps</h2></header>
          <div className="body" style={{ display: 'grid', gap: 6 }}>
            {scales.map((scale) => {
              const value = result.state.s[scale.key] || 0
              return (
                <div key={scale.key} className="sim-scale" data-testid="sim-scale" data-scale={scale.key} data-value={value.toFixed(2)}>
                  <span>{scaleNames[scale.key] || scale.key}{scale.firstOpenRead ? '' : ' (not read at first open)'}</span>
                  <span className="sim-bar"><i style={{ left: value < 0 ? `${50 + value * 50}%` : '50%', width: `${Math.abs(value) * 50}%`, background: value < 0 ? 'var(--orange)' : 'var(--teal)' }} /></span>
                  <b>{value.toFixed(2)}</b>
                </div>
              )
            })}
          </div>
        </section>
        <section className="panel">
          <header className="light"><h2>Lane scores</h2><span className="hint">L1 needs 0.25; L2 needs 0.25 and half of L1</span></header>
          <table className="data">
            <thead><tr><th>Lane</th><th className="num">State</th><th className="num">Score</th><th /></tr></thead>
            <tbody>
              {result.feed.scores.map((row) => (
                <tr key={row.lane} data-testid="sim-lane" data-lane={row.lane}>
                  <td>{laneTitle(row.lane)}</td>
                  <td className="num">{row.stateL.toFixed(2)}</td>
                  <td className="num">{row.score.toFixed(2)}</td>
                  <td>{result.signals.L1?.lane === row.lane ? <span className="badge purple">L1</span> : result.signals.L2?.lane === row.lane ? <span className="badge teal">L2</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <header className="light"><h2>First feed</h2></header>
          <ol className="body" style={{ margin: 0, paddingLeft: 36 }} data-testid="sim-feed">
            {result.feed.items.map((item, index) => (
              <li key={`${item.cutId}-${index}`} data-testid="sim-feed-item" data-lane={item.laneKey || ''}>
                <b>{cutTitles[item.cutId] || `Clip ${item.cutId}`}</b> <span className="hint">{laneTitle(item.laneKey)}{item.clause ? ` · clause ${item.clause}` : ''}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
