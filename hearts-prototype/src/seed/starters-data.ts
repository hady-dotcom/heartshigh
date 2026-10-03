// The starter map from the opening build spec, section 2.9. Titles are the spec's "exact title" column with its
// own notes in brackets taken out; `note` keeps those notes. scripts/ingest-starters.ts checks each title against
// YouTube's oEmbed answer and records the result in content/starters-ingest.json. Every length is the end of the
// talk's last caption in content/transcripts/starters (tests/unit/round3.test.ts holds them to it).
export type StarterRole = 'first' | 'next' | 'mains'

export type StarterRow = {
  lane: string
  role: StarterRole
  title: string
  speaker: string
  youtubeId: string
  lengthSec: number | null
  series?: string
  note?: string
  /** Title of a lesson the prototype already seeds, matched instead of creating a new one. */
  existingTitle?: string
}

const t = (text: string) => {
  const [m, s, h] = text.split(':').reverse().map(Number)
  return (h || 0) * 3600 + (s || 0) * 60 + (m || 0)
}

export const STARTERS: StarterRow[] = [
  { lane: 'trust', role: 'first', title: 'Quranic Connection #26: A Cure for Anxiety | Shaykh Suleiman Hani', speaker: 'Suleiman Hani', youtubeId: 'FAxIZIqwfd8', lengthSec: t('1:04') },
  { lane: 'trust', role: 'next', title: 'Tawakkul: Supreme Trust in Allah - Khutbah by Sh. Mohammad Elshinawy', speaker: 'Mohammad Elshinawy', youtubeId: 'RDlKjwPKgPM', lengthSec: t('19:42') },
  { lane: 'trust', role: 'mains', title: 'Dua 1: O Allah, I am Your Servant | Prophetic Dua | Shaykh Yasir Fahmy', speaker: 'Yasir Fahmy', youtubeId: 'UGuKJLZnbi8', lengthSec: t('12:43'), series: 'Prophetic Duas' },
  { lane: 'company', role: 'first', title: 'On Mosques, Companionship, & Knowledge', speaker: 'Shadee Elmasry', youtubeId: 'N_-YiwIb-u0', lengthSec: t('7:23'), series: 'The Road Ahead' },
  { lane: 'company', role: 'next', title: 'Still Lonely in a Full Masjid? | Imam Khalid Latif & Imam Ahmad Saleem | Muslim Wellness Center', speaker: 'Khalid Latif', youtubeId: '45XUrfJS68Q', lengthSec: t('1:37:01'), note: 'with Ahmad Saleem' },
  { lane: 'company', role: 'mains', title: 'How to Give Good Advice - In Good Company ft. Shaykh Umair Haseeb', speaker: 'Umair Haseeb', youtubeId: 'rUIMxBh3aqo', lengthSec: t('1:13:20'), series: 'In Good Company', note: '3 episodes' },
  { lane: 'lightness', role: 'first', title: 'The BEST Islamic Approach To Wealth | Dr Shadee Elmasry', speaker: 'Shadee Elmasry', youtubeId: 'v42oVXo20VY', lengthSec: t('6:34') },
  { lane: 'lightness', role: 'next', title: 'Contagious Generosity: How To Help Yourself By Helping Others | Imam Khalid | Jummah Reflection', speaker: 'Khalid Latif', youtubeId: 'RZmsvGE785o', lengthSec: t('46:21') },
  { lane: 'lightness', role: 'mains', title: 'Why Wealth Won\'t Give You Peace | The Names Class 21: Ar - Razzaq | Shaykh Mikaeel Smith', speaker: 'Mikaeel Smith', youtubeId: 'U_tCg-U0QSY', lengthSec: t('52:17'), series: 'The Names', note: 'same course as the seeded classes 19 and 20' },
  { lane: 'quiet', role: 'first', title: 'When Knowledge Inflates the Ego | Qur’anic Leadership Ep. 22 | Ramadan Series', speaker: 'Suleiman Hani', youtubeId: 'ja7eQxc9BR8', lengthSec: t('2:48') },
  { lane: 'quiet', role: 'next', title: '[Ep 2] Humility In Practice | Manners of the Salaf | Sh. Mohammad Elshinawy', speaker: 'Mohammad Elshinawy', youtubeId: 'GLOD742Tzbs', lengthSec: t('43:14'), series: 'Manners of the Salaf' },
  { lane: 'quiet', role: 'mains', title: 'Purification of the Heart w/ Ustadha Fatima Lette | Session 1', speaker: 'Fatima Lette', youtubeId: 'WZySKAmC8go', lengthSec: t('1:00:00'), note: '2 sessions' },
  { lane: 'talking', role: 'first', title: 'What is Dua? | EP. 1 | Ramadan 2024 with Dr. Shadee Elmasry', speaker: 'Shadee Elmasry', youtubeId: 'JImcAYzp4D4', lengthSec: t('3:50'), series: 'DUA: The Answered Prayer' },
  { lane: 'talking', role: 'next', title: 'Moments of Solitude: Closeness to God | Jummah Khutbah | Imam Khalid Latif | 3.11.2022', speaker: 'Khalid Latif', youtubeId: 'f-3OxXUp9jc', lengthSec: t('40:24') },
  { lane: 'talking', role: 'mains', title: 'Why You Feel Empty… And How Ramadan Fixes It | The Names Class 20: An-Nūr | Shaykh Mikaeel Smith', speaker: 'Mikaeel Smith', youtubeId: 'NIR88RRpat4', lengthSec: t('47:41'), existingTitle: 'The Names Class 20: Al-Nur', note: 'the full class; content/transcripts/mikaeel-al-nur.md is its transcript. MK5q_zMiX1g is a 95-second clip of it' },
  { lane: 'habits', role: 'first', title: 'Using Your Time Wisely - Episode 01 | The Blessing of Time with Shaykh Suleiman Hani', speaker: 'Suleiman Hani', youtubeId: 'qB3lRpEJwi8', lengthSec: t('6:52') },
  { lane: 'habits', role: 'next', title: 'Self Purification and Discipline methods of Sahaba  - Dr.Umar Faruq Abd Allah', speaker: 'Umar Faruq Abd-Allah', youtubeId: 'xY7hvYifpxo', lengthSec: t('34:49'), note: 'two spaces before the dash, as in the source' },
  { lane: 'habits', role: 'mains', title: 'Ep. 1: Know Your Purpose | Habits To Win Here and Hereafter | Dr. Tesneem Alkiek', speaker: 'Tesneem Alkiek', youtubeId: 'BnU535dqG6U', lengthSec: t('3:47'), series: 'Habits To Win Here and Hereafter' },
  { lane: 'patience', role: 'first', title: 'What Is The Difference Between Patience And Complaining? | Shaykh Suleiman Hani | Faith IQ', speaker: 'Suleiman Hani', youtubeId: '9k7QxXtCzaQ', lengthSec: t('1:56') },
  { lane: 'patience', role: 'next', title: 'How to Manage Your Anger - Amjad Tarsin', speaker: 'Amjad Tarsin', youtubeId: 'fBzrLN77gng', lengthSec: t('4:20') },
  { lane: 'patience', role: 'mains', title: 'Anger Management (p. 1) :: Khutbah by Sh Mohammad Elshinawy', speaker: 'Mohammad Elshinawy', youtubeId: 'Rd0e9kXdPvI', lengthSec: t('28:29'), note: 'parts 1 to 3' },
  { lane: 'gifts', role: 'first', title: 'Gratitude is the Greatest Blessing | Gems from Ibn Ata Illah Ep. 1 | Shaykh Mikaeel Ahmed Smith', speaker: 'Mikaeel Smith', youtubeId: 'rb2EkzjgO98', lengthSec: t('6:37') },
  { lane: 'gifts', role: 'next', title: '"Ramadan Muslims" - Ep. 10: Grateful | Ustadh Naeem Baig', speaker: 'Naeem Baig', youtubeId: 'S0-rlAoc__Q', lengthSec: t('2:44') },
  { lane: 'gifts', role: 'mains', title: 'Finding Contentment Within | Jum\'uah Khutbah | Imam Khalid Latif | 10.7.2022', speaker: 'Khalid Latif', youtubeId: 'HfIT8TSoHiE', lengthSec: t('35:40') },
  { lane: 'mercy', role: 'first', title: 'Which People Receive Allah\'s Mercy?', speaker: 'Shadee Elmasry', youtubeId: 'QOpIvu1uJx0', lengthSec: t('2:04') },
  { lane: 'mercy', role: 'next', title: 'The Servant Prophet ﷺ | Episode 1 - His Mercy', speaker: 'Yasir Fahmy', youtubeId: 'HZgblQ00z1U', lengthSec: t('9:00'), series: 'The Servant Prophet ﷺ', note: 'Ramadan 2025' },
  { lane: 'mercy', role: 'mains', title: 'Our Character - Ustadh Amjad Tarsin | Day 1', speaker: 'Amjad Tarsin', youtubeId: '9kvuzeMaiIs', lengthSec: t('56:43'), note: '2 days' },
  { lane: 'default', role: 'first', title: 'Who Is Truly Nurturing You? | The Names Class 19: Ar-Rabb | Shaykh Mikaeel Smith', speaker: 'Mikaeel Smith', youtubeId: 'ECaTWkof57E', lengthSec: t('38:57'), existingTitle: 'The Names Class 19: Ar-Rabb' },
  { lane: 'default', role: 'mains', title: 'How to Live Like the Prophet ﷺ | Sixth Session', speaker: 'Yasir Fahmy', youtubeId: 'TLCGBj4AlB0', lengthSec: t('2:48:43'), existingTitle: 'How to Live Like the Prophet, Session 6', note: 'transcript only until now; the YouTube id is added' },
  { lane: 'default', role: 'next', title: 'Alhamdulillah! Allah Chose You to Be a Believer | Imam Dawood Yasin', speaker: 'Dawood Yasin', youtubeId: 'tidGQC4SrgA', lengthSec: t('27:34') },
  { lane: 'talking', role: 'next', title: 'The Names Class 20: Al-Nūr | Shaykh Mikaeel Smith', speaker: 'Mikaeel Smith', youtubeId: 'MK5q_zMiX1g', lengthSec: t('1:37'), series: 'The Names: short clips', note: 'a 95-second clip of class 20, the dua for light; listed after the lane\'s main next talk' },
]
