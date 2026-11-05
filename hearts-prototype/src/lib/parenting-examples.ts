/**
 * Public, freely embeddable talks used only so the parenting demo is not empty.
 * Titles stay free of "Part", "Episode", "Session", "Class" and "Day" plus a number,
 * because the course list sorts on those words and would ignore a drag.
 */

export type ExampleFilm = {
  youtubeId: string
  title: string
  speaker: string
  durationSeconds: number
}

export const EXAMPLE_LINES = {
  hook: 'Listen first.',
  turn: 'Turn toward what they need.',
  land: 'Land on one small thing you can try this week.',
  question: 'What is one small thing you could try at home this week?',
  note: "Example lines for the player. They are not this film's real captions.",
}

export const EXAMPLE_TRANSCRIPT = `WEBVTT

00:00:01.000 --> 00:00:04.000
Listen first.

00:00:08.000 --> 00:00:12.000
Turn toward what they need.

00:00:16.000 --> 00:00:20.000
Land on one small thing you can try this week.
`

export const PARENTING_EXAMPLES: ExampleFilm[] = [
  { youtubeId: 'CyElHdaqkjo', title: 'Example 1 · How to raise successful kids — without over-parenting', speaker: 'Julie Lythcott-Haims', durationSeconds: 900 },
  { youtubeId: 'SFnMTHhKdkw', title: 'Example 2 · Every kid needs a champion', speaker: 'Rita Pierson', durationSeconds: 480 },
  { youtubeId: 'H14bBuluwB8', title: 'Example 3 · Grit', speaker: 'Angela Duckworth', durationSeconds: 360 },
  { youtubeId: '_X0mgOOSpLU', title: 'Example 4 · The power of believing that you can improve', speaker: 'Carol Dweck', durationSeconds: 600 },
  { youtubeId: 'DOgsYATbV-s', title: 'Example 5 · For parents, happiness is a very high bar', speaker: 'Jennifer Senior', durationSeconds: 720 },
  { youtubeId: '95ovIJ3dsNk', title: 'Example 6 · How childhood trauma affects health', speaker: 'Nadine Burke Harris', durationSeconds: 960 },
  { youtubeId: 'cplaWsiu7Yg', title: 'Example 7 · What do babies think?', speaker: 'Alison Gopnik', durationSeconds: 1080 },
  { youtubeId: 'HHwXlcHcTHc', title: 'Example 8 · Play is more than just fun', speaker: 'Stuart Brown', durationSeconds: 1560 },
  { youtubeId: 'V-bjOJzB7LY', title: 'Example 9 · What adults can learn from kids', speaker: 'Adora Svitak', durationSeconds: 480 },
  { youtubeId: '9EVEmZ2c_es', title: 'Example 10 · Love, no matter what', speaker: 'Andrew Solomon', durationSeconds: 1380 },
]
