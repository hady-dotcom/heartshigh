import type { Page } from '@playwright/test'

/** A stand-in for the IFrame API, so player chrome (Tap for sound and the rest) renders without YouTube. */
export async function fakeYouTube(page: Page, options: { blockAutoplay?: boolean } = {}) {
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  await page.addInitScript((blockAutoplay) => {
    const gate = window as unknown as { __allowPlay?: boolean; __playerVars?: unknown[]; __unloaded?: string[] }
    gate.__allowPlay = !blockAutoplay
    gate.__playerVars = []
    gate.__unloaded = []
    type Options = { playerVars?: { start?: number }; events: { onReady: (e: unknown) => void; onStateChange: (e: { data: number }) => void } }
    class Player {
      private state = -1
      private time: number
      private muted = true
      private frame: HTMLIFrameElement
      constructor(el: HTMLElement, private options: Options) {
        this.time = options.playerVars?.start || 0
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
      playVideo() { if (gate.__allowPlay) this.set(1) }
      pauseVideo() { this.set(2) }
      stopVideo() { this.set(5) }
      mute() { this.muted = true }
      unMute() { this.muted = false }
      isMuted() { return this.muted }
      cueVideoById(video: { startSeconds?: number }) { this.time = video.startSeconds || 0; this.set(5) }
      seekTo(seconds: number) { this.time = seconds }
      getCurrentTime() { return this.time }
      getDuration() { return 600 }
      getPlayerState() { return this.state }
      getIframe() { return this.frame }
      unloadModule(name: string) { gate.__unloaded!.push(name) }
      setOption() {}
      destroy() { this.frame.remove() }
    }
    ;(window as unknown as { YT: unknown }).YT = { Player }
  }, Boolean(options.blockAutoplay))
}
