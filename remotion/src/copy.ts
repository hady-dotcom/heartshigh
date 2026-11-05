/** British English labels. Speaker lines are never stored here. */
export const UI = {
  hook: 'Hook',
  turn: 'Turn',
  land: 'Land',
  learnMore: 'Learn more',
  fullTalk: 'The full talk',
  kinetic: 'Kinetic',
  windows: 'Windows',
  conversation: 'Conversation',
  cinema: 'Cinema',
  unfold: 'Unfold',
} as const

export const BEAT_LABEL: Record<'hook' | 'turn' | 'land', string> = {
  hook: UI.hook,
  turn: UI.turn,
  land: UI.land,
}
