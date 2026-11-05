import Link from 'next/link'
import { LANE_PROGRESS_EXAMPLE, type LaneProgress } from '@/lib/lane-progress'

/** Watched talks and clips in this lane, against the lane's own list: a count, a bar, and minutes watched. */
export function LaneProgressUnit({
  done,
  total,
  minutesLabel,
  line,
  ratio,
  example = false,
}: {
  done: number
  total: number
  minutesLabel: string
  line: string
  ratio: number
  example?: boolean
}) {
  const width = `${Math.max(0, Math.min(100, ratio * 100))}%`
  return (
    <div
      className="lane-progress"
      data-testid={example ? 'lane-progress-example' : 'lane-progress'}
      data-example={example ? 'yes' : 'no'}
      data-done={done}
      data-total={total}
    >
      {example ? <p className="example-kicker">Example</p> : null}
      <p className="lane-progress-line" data-testid="lane-done">{line}</p>
      <div className="bar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={Math.max(total, 1)} aria-label={line}>
        <i style={{ width }} />
      </div>
      <p className="lane-progress-minutes" data-testid="lane-minutes">{minutesLabel}</p>
      {example ? <p className="example-note">This is an example, not your watching yet.</p> : null}
    </div>
  )
}

/**
 * Real counts when this learner has started the lane.
 * Otherwise a labelled example, plus Start this lane when there is a clip to open.
 */
export function LaneProgressSlot({
  progress,
  startHref,
  continueHref,
  continueLabel,
}: {
  progress: LaneProgress
  startHref?: string
  continueHref?: string
  continueLabel?: string
}) {
  if (!progress.started) {
    return (
      <>
        <LaneProgressUnit
          done={LANE_PROGRESS_EXAMPLE.done}
          total={LANE_PROGRESS_EXAMPLE.total}
          line={LANE_PROGRESS_EXAMPLE.line}
          minutesLabel={LANE_PROGRESS_EXAMPLE.minutesLabel}
          ratio={LANE_PROGRESS_EXAMPLE.ratio}
          example
        />
        {startHref ? (
          <Link className="pill gold" href={startHref} data-testid="start-lane">
            Start this lane
          </Link>
        ) : null}
      </>
    )
  }
  return (
    <>
      <LaneProgressUnit
        done={progress.done}
        total={progress.total}
        line={progress.line}
        minutesLabel={progress.minutesLabel}
        ratio={progress.ratio}
      />
      {continueHref ? (
        <Link className="pill gold" href={continueHref} data-testid="lane-continue">
          {continueLabel || 'Continue'}
        </Link>
      ) : null}
    </>
  )
}
