'use client'

import { useMemo, useState } from 'react'
import { doorCode } from '@/lib/doors'
import { applyTap, freshState, pickSignals, routeFeed, type HeartState, type LaneDef, type CutInfo, type ScaleDef, type ScaleKey, type SceneDef } from '@/lib/heart'
import {
  barelyLine,
  blockedLaneLine,
  countOpeningPaths,
  duplicateLine,
  flatLaneLine,
  newcomerPicks,
  pullWords,
  reviewOpeningQuestions,
  shortLaneLine,
  type FeelingName,
  type PathReport,
} from '@/lib/opening-questions'

type Props = {
  scenes: SceneDef[]
  scales: ScaleDef[]
  feelings: FeelingName[]
  edits: Record<string, string>
  route: { lanes: LaneDef[]; cuts: CutInfo[]; d0CutId: number | null; allowSuggested: boolean; showUnchecked?: boolean }
  cutTitles: Record<number, string>
}

function heatStyle(amount: number | undefined) {
  if (!amount) return undefined
  const strength = Math.min(0.55, Math.abs(amount) / 0.6)
  const color = amount < 0 ? '163, 90, 40' : '30, 122, 122'
  return { background: `rgba(${color}, ${0.15 + strength})` }
}

function amountText(amount: number | undefined) {
  if (!amount) return '0.00'
  const sign = amount > 0 ? '+' : '−'
  return `${sign}${Math.abs(amount).toFixed(2)}`
}

/** Runs the same heart.ts the phones run, on answers the author picks. Nothing here is stored. */
export function Simulator({ scenes, scales, feelings, edits, route, cutTitles }: Props) {
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [optIn, setOptIn] = useState<string[]>([])
  const [counting, setCounting] = useState(false)
  const [paths, setPaths] = useState<PathReport | null>(null)
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

  const review = useMemo(() => reviewOpeningQuestions(scenes, scales, route, optIn, ctx.now), [scenes, scales, route, optIn, ctx.now])

  const laneTitle = (key: string | null) => (key ? route.lanes.find((lane) => lane.key === key)?.title || key : 'The main path')
  const feelingName = (key: ScaleKey) => feelings.find((feeling) => feeling.key === key)?.name || key
  const optInLanes = route.lanes.filter((lane) => lane.optInOnly)
  const flags = [
    ...review.questions.filter((question) => question.barely).map((question) => barelyLine(question.caption)),
    ...review.questions.flatMap((question) => question.duplicates.map((group) => duplicateLine(group.labels, group.detail))),
    ...review.flatLanes.map(flatLaneLine),
    ...review.shortLanes.map(shortLaneLine),
    ...review.blockedLanes.map(blockedLaneLine),
  ]

  const tryPaths = () => {
    setCounting(true)
    window.setTimeout(() => {
      setPaths(countOpeningPaths(scenes, scales, route, optIn, ctx.now))
      setCounting(false)
    }, 30)
  }

  return (
    <div data-testid="simulator">
      <div className="sim-layout">
        <section className="panel">
          <header className="light"><h2>Questions</h2></header>
          <div className="body form">
            {scenes.map((scene, index) => (
              <label className="stack" key={scene.key} data-testid="sim-question" data-number={index + 1} data-scene={scene.key}>
                {index + 1}. {scene.caption.replace(/\*\*/g, '')}
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
            <div className="actions">
              <button type="button" className="btn ink small" data-testid="sim-newcomer" onClick={() => setPicks(newcomerPicks(scenes))}>Try it as a newcomer</button>
              <button type="button" className="btn ghost small" onClick={() => { setPicks({}); setOptIn([]); setPaths(null) }}>Clear</button>
            </div>
          </div>
        </section>
        <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          {result.crisis ? <p className="flash error" data-testid="sim-crisis">This path opens the help screen before any clip.</p> : null}
          <section className="panel">
            <header className="light"><h2>Feelings after these answers</h2></header>
            <div className="body" style={{ display: 'grid', gap: 10 }} data-testid="feeling-plain">
              {scales.map((scale) => {
                const value = result.state.s[scale.key] || 0
                const words = pullWords(value, feelingName(scale.key))
                return (
                  <div key={scale.key} className="sim-scale" data-testid="sim-scale" data-scale={scale.key} data-value={value.toFixed(2)}>
                    <span className="sim-top">
                      <span>{feelingName(scale.key)}{scale.firstOpenRead ? '' : ' (not used on the first questions)'}</span>
                      <b className="sim-words">{words}</b>
                    </span>
                    <span className="sim-bar" aria-hidden><i style={{ left: value < 0 ? `${50 + value * 50}%` : '50%', width: `${Math.abs(value) * 50}%`, background: value < 0 ? 'var(--orange)' : 'var(--teal)' }} /></span>
                  </div>
                )
              })}
              <details className="for-techies" data-testid="feeling-techies">
                <summary>For techies</summary>
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Feeling</th><th className="num">Amount</th></tr></thead>
                    <tbody>
                      {scales.map((scale) => (
                        <tr key={scale.key}>
                          <td>{feelingName(scale.key)}</td>
                          <td className="num">{(result.state.s[scale.key] || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>
          <section className="panel">
            <header className="light"><h2>Which lane comes first</h2></header>
            <div className="body">
              <p className="hint" data-testid="lane-key" style={{ marginTop: 0 }}>A lane is a set of clips about one feeling. The lane that fits these answers best comes first. A second lane can come along when it is close behind.</p>
              <ul className="sim-lanes" data-testid="lane-plain">
                {result.feed.scores.map((row) => {
                  const place = result.signals.L1?.lane === row.lane ? 'first' : result.signals.L2?.lane === row.lane ? 'second' : ''
                  return (
                    <li key={row.lane} data-testid="sim-lane" data-lane={row.lane} data-signal={place === 'first' ? 'L1' : place === 'second' ? 'L2' : ''}>
                      <b>{laneTitle(row.lane)}</b>
                      {place ? <span>this lane comes {place}</span> : null}
                    </li>
                  )
                })}
              </ul>
              <details className="for-techies" data-testid="lane-techies">
                <summary>For techies</summary>
                <p className="hint">A lane comes first when its score is at least 0.25. A second lane also needs a score of at least 0.25, and at least half the first lane’s score.</p>
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>Lane</th><th className="num">From the answers</th><th className="num">Score</th></tr></thead>
                    <tbody>
                      {result.feed.scores.map((row) => (
                        <tr key={row.lane} data-testid="lane-score" data-lane={row.lane}>
                          <td>{laneTitle(row.lane)}</td>
                          <td className="num">{row.stateL.toFixed(2)}</td>
                          <td className="num">{row.score.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </section>
          <section className="panel">
            <header className="light"><h2>First clips</h2></header>
            <ol className="body" style={{ margin: 0, paddingLeft: 36 }} data-testid="sim-feed">
              {result.feed.items.map((item, index) => (
                <li key={`${item.cutId}-${index}`} data-testid="sim-feed-item" data-lane={item.laneKey || ''}>
                  <b>{cutTitles[item.cutId] || `Clip ${item.cutId}`}</b> <span className="hint">{laneTitle(item.laneKey)}{item.door ? ` · Door ${item.door} (${doorCode(item.door)})` : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 18 }} data-testid="question-review">
        <header className="light">
          <h2>Make your questions better</h2>
          <span className="hint">Plain sums, no AI call</span>
        </header>
        <div className="body" style={{ display: 'grid', gap: 14 }}>
          <p style={{ margin: 0 }}>Each row is an answer. Each column is a feeling. The words say which way that answer pulls. A pull away means the feeling is low, so that lane gets stronger.</p>
          {flags.map((flag) => <p key={flag} data-testid="review-flag" style={{ margin: 0 }}>{flag}</p>)}
          {review.suggestions.map((line) => <p key={line} data-testid="review-suggestion" style={{ margin: 0 }}>{line}</p>)}
          {review.questions.map((question) => (
            <div key={question.key} data-testid="question-heat" data-scene={question.key}>
              <p style={{ margin: '0 0 8px' }}>
                <b>{question.number}. {question.caption}</b>{' '}
                <a href={edits[question.key] || '/master/opening'} data-testid="edit-question">Edit question</a>
              </p>
              <div className="q-heat-wrap">
                <table className="data q-heat q-words">
                  <thead>
                    <tr>
                      <th>Answer</th>
                      {feelings.map((feeling) => <th key={feeling.key}>{feeling.name}</th>)}
                      <th>Lane</th>
                    </tr>
                  </thead>
                  <tbody>
                    {question.rows.map((row) => (
                      <tr key={row.key} data-testid="heat-row">
                        <td>{row.label}</td>
                        {feelings.map((feeling) => {
                          const amount = row.amounts[feeling.key] || 0
                          return <td key={feeling.key} style={heatStyle(amount)} data-amount={amount.toFixed(2)}>{pullWords(amount, feeling.name)}</td>
                        })}
                        <td>{row.laneTitle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="for-techies" data-testid="heat-techies">
                <summary>For techies</summary>
                <div className="q-heat-wrap">
                  <table className="data q-heat">
                    <thead>
                      <tr>
                        <th>Answer</th>
                        {feelings.map((feeling) => <th key={feeling.key}>{feeling.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {question.rows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          {feelings.map((feeling) => {
                            const amount = row.amounts[feeling.key] || 0
                            return <td key={feeling.key} data-amount={amount.toFixed(2)}>{amountText(amount)}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          ))}
          <div className="actions">
            <button type="button" className="btn ink small" data-testid="try-every-path" disabled={counting} onClick={tryPaths}>{counting ? 'Counting every path…' : 'Try every answer path'}</button>
          </div>
          {paths ? (
            <div data-testid="path-report">
              <p style={{ marginTop: 0 }}>{paths.paths.toLocaleString('en-GB')} paths. How often each lane comes first:</p>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Lane</th><th className="num">Times first</th><th className="num">Share</th></tr></thead>
                  <tbody>
                    {paths.wins.map((row) => (
                      <tr key={row.title} data-testid="path-win" data-lane={row.lane || ''}>
                        <td>{row.title}</td>
                        <td className="num">{row.count.toLocaleString('en-GB')}</td>
                        <td className="num">{Math.round(row.share * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
