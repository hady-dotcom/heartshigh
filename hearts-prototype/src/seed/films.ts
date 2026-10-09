// The three talks the prototype seeded first, with their transcript files and pop-ups. The seed checks every cut and
// pop-up against each talk's real duration.
export type Film = {
  title: string
  speaker: string
  file: string
  youtubeUrl: string
  youtubeId: string
  importToken: string
  summary: string
  durationSeconds?: number
  points: { second: number; kind: string; prompt: string; options?: string[]; future?: boolean }[]
}

export const FILMS: Film[] = [
  {
    title: 'How to Live Like the Prophet, Session 6',
    speaker: 'Shaykh Yasir Fahmy',
    file: 'fahmy-session6.md',
    youtubeUrl: '',
    youtubeId: '',
    importToken: 'FAHMY-S6',
    summary: 'Shaykh Yasir Fahmy on sending blessings on the Prophet, and on the ease he was sent with.',
    points: [
      { second: 300, kind: 'reflection', prompt: 'Which one manner of the Prophet would you like to carry with you this week?' },
    ],
  },
  {
    title: 'The Names Class 19: Ar-Rabb',
    speaker: 'Shaykh Mikaeel Smith',
    file: 'mikaeel-ar-rabb.md',
    youtubeUrl: 'https://www.youtube.com/watch?v=ECaTWkof57E',
    youtubeId: 'ECaTWkof57E',
    importToken: 'AR-RABB',
    summary: 'Shaykh Mikaeel Smith on Ar-Rabb, the Lord who owns, nurtures and raises you from one stage to the next.',
    points: [
      { second: 120, kind: 'reflection', prompt: 'What is one thing you have that you could see as Allah\'s rather than yours?' },
    ],
  },
  {
    title: 'Why You Feel Empty… And How Ramadan Fixes It | The Names Class 20: An-Nūr | Shaykh Mikaeel Smith',
    speaker: 'Shaykh Mikaeel Smith',
    file: 'mikaeel-al-nur.md',
    youtubeUrl: 'https://www.youtube.com/watch?v=NIR88RRpat4',
    youtubeId: 'NIR88RRpat4',
    // The full 47:41 class. MK5q_zMiX1g carries the same title but is a 95-second clip of it.
    durationSeconds: 2861,
    importToken: 'AL-NUR',
    summary: 'Shaykh Mikaeel Smith on Al-Nur, the light that enters the heart and changes how you see.',
    points: [
      { second: 22, kind: 'multiple_choice', prompt: 'What does the Shaykh say is the first sign that light is entering the heart?', options: ['You start to incline towards the Akhira', 'You feel no more sadness', 'You stop making mistakes'] },
      { second: 158, kind: 'reflection', prompt: 'When did you last feel the change that comes in Ramadan? What did it feel like?' },
      { second: 262, kind: 'task', prompt: 'Call on Allah by the name Al-Nur once a day this week. Note one moment it changed how you saw something.', future: true },
    ],
  },
]
