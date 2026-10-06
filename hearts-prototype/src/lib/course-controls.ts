/**
 * The course film is chromeless: YouTube's bar is off, and the iframe does not take taps.
 * Play and pause are a tap on the picture. A question holds the film, so the catcher
 * steps aside until that sheet closes. Whether the film is playing does not hide it.
 */
export function coursePlayVisible(input: { loading: boolean; questionOpen: boolean }) {
  return !input.loading && !input.questionOpen
}
