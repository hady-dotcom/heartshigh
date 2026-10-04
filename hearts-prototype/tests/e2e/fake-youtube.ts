import type { Page } from '@playwright/test'

/** A stand-in for the IFrame API, so player chrome (Tap for sound and the rest) renders without YouTube. */
export async function fakeYouTube(page: Page, options: { blockAutoplay?: boolean } = {}) {
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  await page.addInitScript((blockAutoplay) => {
    const gate = window as unknown as { __allowPlay?: boolean; __gestured?: boolean; __playerVars?: unknown[]; __unloaded?: string[] }
    gate.__allowPlay = !blockAutoplay
    gate.__gestured = !blockAutoplay
    gate.__playerVars = []
    gate.__unloaded = []
    document.addEventListener('pointerdown', () => { gate.__gestured = true }, true)
    document.addEventListener('click', () => { gate.__gestured = true }, true)
    type Options = { playerVars?: { start?: number; end?: number }; events: { onReady: (e: unknown) => void; onStateChange: (e: { data: number }) => void } }
    class Player {
      private state = -1
      private time: number
      private end: number | null = null
      private muted = true
      private tick: number | null = null
      private frame: HTMLIFrameElement
      constructor(el: HTMLElement, private options: Options) {
        this.time = options.playerVars?.start || 0
        this.end = typeof options.playerVars?.end === 'number' ? Number(options.playerVars.end) : null
        gate.__playerVars!.push(options.playerVars)
        this.frame = document.createElement('iframe')
        this.frame.dataset.fake = 'youtube'
        el.replaceWith(this.frame)
        window.setTimeout(() => options.events.onReady({ target: this }), 30)
      }
      private set(state: number) {
        this.state = state
        this.options.events.onStateChange({ data: state })
      }
      private origin = 0
      private originTime = 0
      private run() {
        if (this.tick != null) return
        this.origin = performance.now()
        this.originTime = this.time
        this.tick = window.setInterval(() => {
          if (this.state !== 1) return
          this.time = this.originTime + (performance.now() - this.origin) / 1000
          if (this.end != null && this.time >= this.end) {
            this.time = this.end
            this.stopClock()
            this.set(0)
          }
        }, 100)
      }
      private stopClock() {
        if (this.tick != null) window.clearInterval(this.tick)
        this.tick = null
      }
      playVideo() { if (gate.__allowPlay || gate.__gestured) { this.set(1); this.run() } }
      pauseVideo() { this.stopClock(); this.set(2) }
      stopVideo() { this.stopClock(); this.set(5) }
      mute() { this.muted = true }
      unMute() { this.muted = false }
      isMuted() { return this.muted }
      cueVideoById(video: { startSeconds?: number; endSeconds?: number }) {
        this.stopClock()
        this.time = video.startSeconds || 0
        this.end = typeof video.endSeconds === 'number' ? video.endSeconds : this.end
        this.set(5)
      }
      seekTo(seconds: number) {
        this.time = seconds
        this.origin = performance.now()
        this.originTime = seconds
      }
      getCurrentTime() { return this.time }
      getDuration() { return 600 }
      getPlayerState() { return this.state }
      getIframe() { return this.frame }
      unloadModule(name: string) { gate.__unloaded!.push(name) }
      setOption() {}
      destroy() { this.stopClock(); this.frame.remove() }
    }
    ;(window as unknown as { YT: unknown }).YT = { Player }
  }, Boolean(options.blockAutoplay))
}
