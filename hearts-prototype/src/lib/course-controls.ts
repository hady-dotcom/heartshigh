/**
 * The course film is chromeless: YouTube's bar is off, and the iframe does not take taps.
 * Play and pause have to stay on the lecture the whole time it is up.
 * A question holds the film itself, so the button steps aside until that sheet closes.
 * Whether the film is currently playing does not hide the control.
 */
export function coursePlayVisible(input: { loading: boolean; questionOpen: boolean }) {
  return !input.loading && !input.questionOpen
}
