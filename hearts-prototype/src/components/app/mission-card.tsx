import Link from 'next/link'
import type { MissionDoc } from '@/server/missions'
import { missionProgress } from '@/lib/mission-maths'

export function MissionCard({ mission, base, joined, compact = false }: { mission: MissionDoc; base: string; joined?: number; compact?: boolean }) {
  const progress = missionProgress(joined ?? 0, mission.target)
  if (compact) {
    return (
      <section className="mission-card compact" data-testid="mission-card">
        <p className="eyebrow">Help shape Hady Core</p>
        <p><b>{mission.title}</b> · {progress.line}</p>
        <Link className="pill gold small" href={`${base}/mission/${mission.id}`} data-testid="mission-open">See this ask</Link>
      </section>
    )
  }
  return (
    <section className="mission-card" data-testid="mission-card">
      <p className="eyebrow">Help shape Hady Core</p>
      <h2>{mission.title}</h2>
      <p>{mission.ask}</p>
      <p className="muted">{progress.line}</p>
      <Link className="pill gold" href={`${base}/mission/${mission.id}`} data-testid="mission-open">See this ask</Link>
    </section>
  )
}
