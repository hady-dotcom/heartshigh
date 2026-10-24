/**
 * Joining / placing questions. The four default rows stay global so every portal
 * already has a bank. Extra rows can be attached to one portal, and a portal
 * admin can add their own. Additive: nothing here deletes a question that is already there.
 */

export type PlacingBankRow = {
  key: string
  prompt: string
  why: string
  options: string[]
}

/** Shown in every portal unless a portal hides them. Keep these four stable: e2e joining walks them. */
export const PLACING_DEFAULT: PlacingBankRow[] = [
  {
    key: 'who-you-answer-to',
    prompt: 'When you think about who you answer to, who comes to mind first?',
    why: 'This helps us choose whether your first sitting is about Allah, the Prophet, or the people around you.',
    options: ['My Lord | 22', 'The Prophet | 3', 'The people I look after | 4', 'I am not sure yet | 2'],
  },
  {
    key: 'what-you-want',
    prompt: 'What would you most like to get from a sitting like this?',
    why: 'Some people come for prayer, some for character, some to know Allah better. We start where you are.',
    options: ['Prayer that holds steady | 15', 'Being kinder to people | 31', 'Knowing the names of Allah | 22', 'A calm place to start | 2'],
  },
  {
    key: 'hard-week',
    prompt: 'When a hard week comes, what do you usually do?',
    why: 'Knowing this helps us pick a talk that meets you on an ordinary day.',
    options: ['I go quiet | 30', 'I get short with people | 31', 'I look for a verse | 24', 'I keep busy | 13'],
  },
  {
    key: 'first-talk',
    prompt: 'Where would you like your first proper talk to begin?',
    why: 'This helps us pick the first talk from the door you would like to walk through.',
    options: ['With the Prophet | 3', 'With prayer | 15', 'With Allah as Lord | 22', 'With how I treat people | 31'],
  },
]

/** Extra joining questions a portal can attach. Not global, so existing joining walks stay four questions. */
export const PLACING_EXTRA: PlacingBankRow[] = [
  {
    key: 'spare-ten',
    prompt: 'When you have a spare ten minutes, what do you usually reach for?',
    why: 'This helps us pick a first talk that meets an ordinary pause, not a special day.',
    options: ['A short prayer | 15', 'A message to someone I care about | 4', 'My phone, if I am honest | 31', 'A page I have been meaning to read | 24'],
  },
  {
    key: 'who-you-sit-with',
    prompt: 'Who do you sit with when you want to think something through?',
    why: 'Company shapes the first sitting we offer.',
    options: ['Family | 4', 'A friend from the masjid | 8', 'I sit with it on my own | 30', 'Someone who knows more than me | 2'],
  },
  {
    key: 'morning',
    prompt: 'What does an ordinary morning look like for you, before the day takes over?',
    why: 'A talk that names Fajr, the commute or the school run lands better when we know which one is yours.',
    options: ['Prayer, then the house wakes | 15', 'Straight into getting people out the door | 4', 'I am already on the train | 13', 'I am still finding a rhythm | 2'],
  },
  {
    key: 'kindness',
    prompt: 'Where does kindness show up in your week, if it shows up at all?',
    why: 'Some people want a talk on character first. Others want worship. This helps us hear which.',
    options: ['With the people in my house | 4', 'With strangers, on a good day | 6', 'I am kinder in Ramadan | 17', 'I am trying to learn what it looks like | 31'],
  },
  {
    key: 'names',
    prompt: 'When you hear one of the names of Allah, what do you do with it?',
    why: 'A sitting on the names is a different first door from a sitting on manners.',
    options: ['I sit with it for a minute | 22', 'I say it and keep walking | 21', 'I look it up later | 24', 'I am still new to that | 2'],
  },
  {
    key: 'masjid',
    prompt: 'What brings you to a sitting like this, tonight?',
    why: 'People arrive for different reasons. We start with the one they named.',
    options: ['I want to know my Lord better | 22', 'I want to be steadier with prayer | 15', 'I came with someone | 8', 'I just wanted a quiet room | 2'],
  },
  {
    key: 'week-end',
    prompt: 'At the end of a long week, what do you wish you had done more of?',
    why: 'This leans the first talk toward worship, people, or a calmer start.',
    options: ['Prayed with more presence | 15', 'Been gentler at home | 31', 'Remembered Allah in the ordinary hours | 21', 'Rested without feeling I wasted it | 27'],
  },
  {
    key: 'prophet-near',
    prompt: 'When the Prophet is spoken about, what do you find yourself wanting?',
    why: 'Some first talks stay with his manners. Some stay with how we live now.',
    options: ['To know how he was with people | 3', 'To copy one small habit | 10', 'To feel he is not far from this week | 37', 'A calm place to begin | 2'],
  },
]

export const PLACING_BANK = [...PLACING_DEFAULT, ...PLACING_EXTRA]

export function placingBankByKey(key: string) {
  return PLACING_BANK.find((row) => row.key === key) || null
}

export function foldPlacingPrompt(prompt: string) {
  return prompt.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
}
