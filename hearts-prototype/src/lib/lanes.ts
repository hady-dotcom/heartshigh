// A lane's own clips, for the Lanes screen and for /feed?lane=<key>. Plain module: the server and the device share it.
import type { CutInfo, LaneDef } from './heart'
import type { FeedItem } from '../server/learner'

const ROLE_ORDER = { first: 0, next: 1, mains: 2 } as const

/** The lane's starter talks in order (first, next, mains), then clips confirmed for the lane, strongest first. */
export function laneClips(clips: Record<string, FeedItem>, cuts: CutInfo[], lane: string, title: string): FeedItem[] {
  const rows = cuts.map((cut) => ({ cut, clip: clips[String(cut.id)] })).filter((row) => Boolean(row.clip))
  const starters = rows.filter((row) => row.cut.starter?.lane === lane).sort((a, b) => ROLE_ORDER[a.cut.starter!.role] - ROLE_ORDER[b.cut.starter!.role])
  const weight = (cut: CutInfo) => cut.lanes.find((tag) => tag.lane === lane && tag.confirmed)?.weight ?? 0
  const tagged = rows.filter((row) => row.cut.starter?.lane !== lane && weight(row.cut) > 0).sort((a, b) => weight(b.cut) - weight(a.cut) || a.cut.id - b.cut.id)
  return [...starters, ...tagged].map((row) => ({ ...row.clip, laneKey: lane, lane, laneLabel: title }))
}

/** Clips a lane can actually play: a YouTube id, and not a typing or face-film card. */
export function playableLaneClips(clips: Record<string, FeedItem>, cuts: CutInfo[], lane: string, title: string): FeedItem[] {
  return laneClips(clips, cuts, lane, title).filter((clip) => Boolean(clip.youtubeId) && (!clip.card || clip.card === 'talk'))
}

/** Every lane that has at least one clip, in the lanes' own order, with its clips. Opt-in lanes stay out. */
export function lanesWithClips(route: { lanes: LaneDef[]; cuts: CutInfo[] }, clips: Record<string, FeedItem>, titles: Record<string, string>) {
  return route.lanes
    .filter((lane) => !lane.optInOnly)
    .map((lane) => ({ key: lane.key, title: titles[lane.key] || lane.title, clips: playableLaneClips(clips, route.cuts, lane.key, titles[lane.key] || lane.title) }))
    .filter((lane) => lane.clips.length > 0)
}
