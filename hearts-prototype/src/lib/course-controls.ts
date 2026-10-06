/**
 * The course film is chromeless: YouTube's bar is off, and the iframe does not take taps.
 * Play and pause are a tap on the picture. A question holds the film, so the catcher
 * steps aside until that sheet closes. Whether the film is playing does not hide it.
 */
export function coursePlayVisible(input: { loading: boolean; questionOpen: boolean }) {
  return !input.loading && !input.questionOpen
}

type CatcherPlayer = {
  getPlayerState(): number
  pauseVideo(): void
  playVideo(): void
}

/**
 * A tap on the course picture: pause while PLAYING or BUFFERING, play while PAUSED or CUED.
 * Never seek or reload. Same rule as the feed catcher.
 */
export function courseCatcherTap(player: CatcherPlayer | null): 'pause' | 'play' | 'none' {
  if (!player) return 'none'
  const state = player.getPlayerState()
  if (state === 1 || state === 3) {
    player.pauseVideo()
    return 'pause'
  }
  if (state === 2 || state === 5) {
    player.playVideo()
    return 'play'
  }
  return 'none'
}
