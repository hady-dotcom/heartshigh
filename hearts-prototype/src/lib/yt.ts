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
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getIframe(): HTMLIFrameElement
  destroy(): void
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

export type PlayerKind = 'hors' | 'full'

export function playerVars(kind: PlayerKind, start: number, end?: number | null) {
  const base = {
    start: Math.max(0, Math.floor(start)),
    playsinline: 1,
    rel: 0,
    iv_load_policy: 3,
    modestbranding: 1,
    cc_load_policy: 0,
    cc_lang_pref: 'en',
    enablejsapi: 1,
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
    autoplay: 0,
  }
  if (kind === 'hors') return { ...base, end: end ? Math.ceil(end) : undefined, controls: 0, fs: 0, disablekb: 1 }
  return { ...base, ...(end ? { end: Math.ceil(end) } : {}), controls: 1, fs: 1, disablekb: 0 }
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
  return new Promise((resolve) => {
    const player: YTPlayer = new YT.Player(mount, {
      host: NOCOOKIE,
      videoId: options.videoId,
      width: '100%',
      height: '100%',
      playerVars: playerVars(options.kind, options.start, options.end),
      events: {
        onReady: () => {
          players.set(options.id, player)
          // playerVars only take whole seconds; clips open and close between sentences, so cue the exact times.
          if (options.start % 1 || (options.end && options.end % 1)) player.cueVideoById({ videoId: options.videoId, startSeconds: options.start, ...(options.end ? { endSeconds: options.end } : {}) })
          resolve(player)
          options.onReady?.(player)
        },
        onStateChange: (event: { data: number }) => {
          record.state = event.data
          options.onState?.(event.data, player)
        },
        onError: (event: { data: number }) => options.onError?.(event.data),
      },
    })
  })
}

export function cue(id: string, player: YTPlayer, videoId: string, start: number, end?: number | null) {
  const record = records.find((row) => row.id === id)
  if (record) Object.assign(record, { videoId, start, end: end ?? null })
  player.cueVideoById({ videoId, startSeconds: start, ...(end ? { endSeconds: end } : {}) })
}

export function setHidden(id: string, hidden: boolean) {
  const record = records.find((row) => row.id === id)
  if (record) record.hidden = hidden
}

let unmuted = false

/** Scripted playback: pause every other player, start muted until the learner has asked for sound once. */
export function playOnly(id: string) {
  const player = players.get(id)
  if (!player) return
  for (const [other, item] of players) if (other !== id) item.pauseVideo()
  if (unmuted) player.unMute()
  else player.mute()
  const record = records.find((row) => row.id === id)
  if (record) record.playCalls += 1
  player.playVideo()
}

/** Learner-started playback (the full lesson): pause every other player and keep the sound as it is. */
export function resume(id: string) {
  const player = players.get(id)
  if (!player) return
  for (const [other, item] of players) if (other !== id) item.pauseVideo()
  const record = records.find((row) => row.id === id)
  if (record) record.playCalls += 1
  player.playVideo()
}

export function soundOn(id: string) {
  unmuted = true
  players.get(id)?.unMute()
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
