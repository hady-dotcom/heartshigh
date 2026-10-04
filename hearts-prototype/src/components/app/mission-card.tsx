import Link from 'next/link'
import type { MissionDoc } from '@/server/missions'
import { missionProgress } from '@/lib/mission-maths'

export function MissionCard({ mission, base, joined }: { mission: MissionDoc; base: string; joined?: number }) {
  const progress = missionProgress(joined ?? 0, mission.target)
  return (
    <section className="mission-card" data-testid="mission-card">
      <p className="eyebrow">Help shape HEARTS</p>
      <h2>{mission.title}</h2>
      <p>{mission.ask}</p>
      <p className="muted">{progress.line}</p>
      <Link className="pill gold" href={`${base}/mission/${mission.id}`} data-testid="mission-open">See this ask</Link>
    </section>
  )
}
