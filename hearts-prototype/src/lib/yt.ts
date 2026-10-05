// YouTube IFrame Player API wrapper (spec 7A.10). Every clip, the first included, plays through here.
// Players are created on the nocookie host, start muted, and never more than one plays at a time.

export const NOCOOKIE = 'https://www.youtube-nocookie.com'
export const API_SRC = 'https://www.youtube.com/iframe_api'

export const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

export type YTPlayer = {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  mute(): void
  unMute(): void
  isMuted(): boolean
  cueVideoById(options: { videoId: string; startSeconds?: number; endSeconds?: number }): void
  loadVideoById?(options: { videoId: string; startSeconds?: number; endSeconds?: number }): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  setPlaybackRate?(rate: number): void
  getPlaybackRate?(): number
  getIframe(): HTMLIFrameElement
  destroy(): void
  unloadModule?(name: string): void
  setOption?(module: string, option: string, value: unknown): void
}

type YTNamespace = { Player: new (el: HTMLElement, options: Record<string, unknown>) => YTPlayer }

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
    __HEARTS_YT?: PlayerRecord[]
  }
}

let apiPromise: Promise<YTNamespace> | null = null

/** Loads the IFrame API once. Callers wait for 'Let's play' or 'Just show me something' first (P12). */
export function loadApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.dataset.ytApi = 'yes'
    script.onerror = () => {
      apiPromise = null
      reject(new Error('The video player could not load.'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

/** Starts loading the API when the browser is idle. */
export function preloadApi() {
  if (typeof window === 'undefined') return
  const go = () => void loadApi().catch(() => undefined)
  const idle = (window as Window & { requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  if (idle) idle(go, { timeout: 1500 })
  else window.setTimeout(go, 200)
}

/** Feed clips and the course player are both chromeless. Captions, the title bar, the logo and the red button stay off. */
export type PlayerKind = 'hors' | 'appetiser' | 'full'

export function playerVars(kind: PlayerKind, start: number, end?: number | null) {
  const base = {
    start: Math.max(0, Math.floor(start)),
    playsinline: 1,
    rel: 0,
    iv_load_policy: 3,
    modestbranding: 1,
    cc_load_policy: 0,
    enablejsapi: 1,
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
    autoplay: 0,
  }
  // A language preference is itself a nudge to load captions. None of the learner players send one.
  if (kind === 'hors') return { ...base, end: end ? Math.ceil(end) : undefined, controls: 0, fs: 0, disablekb: 1 }
  return { ...base, ...(end ? { end: Math.ceil(end) } : {}), controls: 0, fs: 0, disablekb: 1 }
}

/**
 * cc_load_policy is only a hint; the learner's own YouTube setting can still load captions over our buttons.
 * We draw our own lines, so the feed's players drop YouTube's caption module whenever it could have come back.
 */
export function dropCaptions(player: YTPlayer) {
  for (const name of ['captions', 'cc']) {
    try {
      player.unloadModule?.(name)
    } catch {
      // Older players have no such module.
    }
  }
  try {
    player.setOption?.('captions', 'track', {})
  } catch {
    // The module is already gone.
  }
}

export type PlayerRecord = { id: string; videoId: string; start: number; end: number | null; state: number; hidden: boolean; playCalls: number; host: HTMLElement }

const records: PlayerRecord[] = []
const players = new Map<string, YTPlayer>()
if (typeof window !== 'undefined') window.__HEARTS_YT = records

export type CreateOptions = {
  id: string
  host: HTMLElement
  videoId: string
  start: number
  end?: number | null
  kind: PlayerKind
  hidden?: boolean
  onReady?: (player: YTPlayer) => void
  onState?: (state: number, player: YTPlayer) => void
  onError?: (code: number) => void
}

/** Creates a player inside `host`. The host keeps its place in the DOM for the player's whole life. */
export async function createPlayer(options: CreateOptions): Promise<YTPlayer> {
  const YT = await loadApi()
  const mount = document.createElement('div')
  options.host.replaceChildren(mount)
  const record: PlayerRecord = { id: options.id, videoId: options.videoId, start: options.start, end: options.end ?? null, state: STATE.UNSTARTED, hidden: Boolean(options.hidden), playCalls: 0, host: options.host }
  records.push(record)
  return new Promise((resolve, reject) => {
    const player: YTPlayer = new YT.Player(mount, {
      host: NOCOOKIE,
      videoId: options.videoId,
      width: '100%',
      height: '100%',
      playerVars: playerVars(options.kind, options.start, options.end),
      events: {
        onReady: () => {
          players.set(options.id, player)
          dropCaptions(player)
          // playerVars only take whole seconds; clips open and close between sentences, so cue the exact times.
          if (options.start % 1 || (options.end && options.end % 1)) player.cueVideoById({ videoId: options.videoId, startSeconds: options.start, ...(options.end ? { endSeconds: options.end } : {}) })
          resolve(player)
          options.onReady?.(player)
        },
        onStateChange: (event: { data: number }) => {
          record.state = event.data
          if (event.data === STATE.PLAYING || event.data === STATE.BUFFERING || event.data === STATE.CUED) dropCaptions(player)
          if (record.hidden && (event.data === STATE.PLAYING || event.data === STATE.BUFFERING)) hush(player)
          options.onState?.(event.data, player)
        },
        onError: (event: { data: number }) => {
          options.onError?.(event.data)
          reject(new Error(`The film could not start (${event.data}).`))
        },
      },
    })
  })
}

function hush(player: YTPlayer) {
  try {
    player.mute()
  } catch {
    // The iframe may already have gone.
  }
  try {
    player.pauseVideo()
  } catch {
    // Same.
  }
}

export function cue(id: string, player: YTPlayer, videoId: string, start: number, end?: number | null) {
  const record = records.find((row) => row.id === id)
  if (record) Object.assign(record, { videoId, start, end: end ?? null })
  player.cueVideoById({ videoId, startSeconds: start, ...(end ? { endSeconds: end } : {}) })
  if (record?.hidden) hush(player)
}

export function setHidden(id: string, hidden: boolean) {
  const record = records.find((row) => row.id === id)
  if (record) record.hidden = hidden
  const player = players.get(id)
  if (hidden && player) hush(player)
}

let unmuted = false

/** Pause and mute one player. Hidden hosts must never keep talking. */
export function silence(id: string) {
  const player = players.get(id)
  if (player) hush(player)
}

/** Pause and mute every player except `keep`, including hosts that are still buffering. */
export function silenceOthers(keep?: string) {
  for (const [other, item] of players) if (other !== keep) hush(item)
}

/** Any host marked hidden that reports PLAYING or BUFFERING is paused and muted at once. */
export function silenceHidden() {
  for (const record of records) {
    if (!record.hidden) continue
    const player = players.get(record.id)
    if (!player) continue
    const state = player.getPlayerState()
    if (state === STATE.PLAYING || state === STATE.BUFFERING) hush(player)
  }
}

export function playerSnapshot() {
  return records.map((row) => {
    const player = players.get(row.id)
    return {
      id: row.id,
      videoId: row.videoId,
      hidden: row.hidden,
      state: player ? player.getPlayerState() : row.state,
      muted: player ? player.isMuted() : true,
      currentTime: player ? player.getCurrentTime() : row.start,
    }
  })
}

/** Scripted playback: pause every other player, start muted until the learner has asked for sound once. */
export function playOnly(id: string) {
  const player = players.get(id)
  if (!player) return
  silenceOthers(id)
  const record = records.find((row) => row.id === id)
  if (record?.hidden) {
    hush(player)
    return
  }
  if (unmuted) player.unMute()
  else player.mute()
  if (record) record.playCalls += 1
  player.playVideo()
}

/** Learner-started playback (the full lesson): pause every other player and keep the sound as it is. */
export function resume(id: string) {
  const player = players.get(id)
  if (!player) return
  silenceOthers(id)
  const record = records.find((row) => row.id === id)
  if (record?.hidden) {
    hush(player)
    return
  }
  if (record) record.playCalls += 1
  player.playVideo()
}

export function soundOn(id: string) {
  unmuted = true
  if (typeof window !== 'undefined') {
    try {
      const key = 'hearts.session.v1'
      const held = JSON.parse(window.sessionStorage.getItem(key) || '{"sheetCount":0}') as { sheetCount?: number; unmuted?: boolean }
      window.sessionStorage.setItem(key, JSON.stringify({ ...held, unmuted: true }))
    } catch {
      // Private browsing: sound still stays on for this page.
    }
  }
  players.get(id)?.unMute()
}

export function hydrateSound() {
  if (unmuted || typeof window === 'undefined') return unmuted
  try {
    const held = JSON.parse(window.sessionStorage.getItem('hearts.session.v1') || '{}') as { unmuted?: boolean }
    if (held.unmuted) unmuted = true
  } catch {
    // ignore
  }
  return unmuted
}

export const hasSound = () => unmuted

export function destroyPlayer(id: string) {
  const player = players.get(id)
  players.delete(id)
  const at = records.findIndex((row) => row.id === id)
  if (at >= 0) records.splice(at, 1)
  try {
    player?.destroy()
  } catch {
    // The iframe may already be gone with its host.
  }
}

export function getPlayer(id: string) {
  return players.get(id) || null
}

/** Section 7A.6: on a data saver or a 2G link, no hidden players and no preloading. */
export function lowData() {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return Boolean(connection?.saveData) || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g'
}

/** True once at least half of the element is on screen (scripted playback rule). */
export function halfVisible(el: Element) {
  const rect = el.getBoundingClientRect()
  const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
  const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
  return rect.width > 0 && rect.height > 0 && (width * height) / (rect.width * rect.height) >= 0.5
}

export const UNPLAYABLE = new Set([2, 5, 100, 101, 150])
