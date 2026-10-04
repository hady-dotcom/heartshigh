import type { Page } from '@playwright/test'

/** A stand-in for the IFrame API, so player chrome (Tap for sound and the rest) renders without YouTube. */
export async function fakeYouTube(page: Page, options: { blockAutoplay?: boolean; failFirst?: boolean } = {}) {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAASwAAADICAYAAABS39xVAAABjklEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPgZcLwAAe0nOggAAAABJRU5ErkJggg==', 'base64')
  await page.route(/i\.ytimg\.com|img\.youtube\.com/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: png })
  })
  await page.route(/youtube|googlevideo/, (route) => route.abort())
  await page.addInitScript(({ blockAutoplay, failFirst }) => {
    const gate = window as unknown as { __allowPlay?: boolean; __playerVars?: unknown[]; __unloaded?: string[]; __failFirst?: boolean; __fails?: number }
    gate.__allowPlay = !blockAutoplay
    gate.__playerVars = []
    gate.__unloaded = []
    gate.__failFirst = failFirst || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('heartsFailFirst') === '1')
    gate.__fails = 0
    type Options = { playerVars?: { start?: number }; events: { onReady: (e: unknown) => void; onStateChange: (e: { data: number }) => void; onError?: (e: { data: number }) => void } }
    class Player {
      private state = -1
      private time: number
      private muted = true
      private rate = 1
      private tick: number | null = null
      private frame: HTMLIFrameElement
      constructor(el: HTMLElement, private options: Options) {
        this.time = options.playerVars?.start || 0
        gate.__playerVars!.push(options.playerVars)
        this.frame = document.createElement('iframe')
        this.frame.dataset.fake = 'youtube'
        this.frame.setAttribute('title', 'Talk film')
        this.frame.style.cssText = 'width:100%;height:100%;border:0;background:#0e2a2b url("/theme/evening-courtyard.jpg") center 40% / cover no-repeat'
        el.replaceWith(this.frame)
        if (gate.__failFirst && !gate.__fails) {
          gate.__fails = 1
          window.setTimeout(() => options.events.onError?.({ data: 2 }), 30)
          return
        }
        window.setTimeout(() => options.events.onReady({ target: this }), 30)
      }
      private set(state: number) {
        this.state = state
        this.options.events.onStateChange({ data: state })
      }
      playVideo() {
        if (!gate.__allowPlay) return
        this.set(1)
        if (this.tick == null) this.tick = window.setInterval(() => { this.time += 0.25 * this.rate }, 250)
      }
      pauseVideo() {
        if (this.tick != null) window.clearInterval(this.tick)
        this.tick = null
        this.set(2)
      }
      stopVideo() { this.pauseVideo(); this.set(5) }
      mute() { this.muted = true }
      unMute() { this.muted = false }
      isMuted() { return this.muted }
      cueVideoById(video: { startSeconds?: number }) { this.time = video.startSeconds || 0; this.set(5) }
      seekTo(seconds: number) { this.time = seconds }
      getCurrentTime() { return this.time }
      getDuration() { return 600 }
      getPlayerState() { return this.state }
      setPlaybackRate(rate: number) { this.rate = rate }
      getPlaybackRate() { return this.rate }
      getIframe() { return this.frame }
      unloadModule(name: string) { gate.__unloaded!.push(name) }
      setOption() {}
      destroy() { if (this.tick != null) window.clearInterval(this.tick); this.frame.remove() }
    }
    ;(window as unknown as { YT: unknown }).YT = { Player }
  }, { blockAutoplay: Boolean(options.blockAutoplay), failFirst: Boolean(options.failFirst) })
}
