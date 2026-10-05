/** Age bands and the child-safe defaults (L04). We store a band, never a birth date. */

export const AGE_BANDS = ['under-13', '13-17', '18+'] as const

export type AgeBand = (typeof AGE_BANDS)[number]

export type ChildDefaults = {
  mayShareWithLearners: boolean
  mayShareWatchHistory: boolean
  answersSavedForTeachers: boolean
  liveQuestionShowsName: boolean
  insightsBeyondAggregates: boolean
  gatherPhotoNeedsHostTick: boolean
  waitingForGrownUp: boolean
  mayWatch: boolean
}

export function isAgeBand(value: unknown): value is AgeBand {
  return value === 'under-13' || value === '13-17' || value === '18+'
}

export function isChild(band: AgeBand | null | undefined) {
  return band === 'under-13' || band === '13-17'
}

export function isUnder13(band: AgeBand | null | undefined) {
  return band === 'under-13'
}

export function childDefaults(band: AgeBand | null | undefined, waitingForGuardian = false): ChildDefaults {
  if (!band || band === '18+') {
    return {
      mayShareWithLearners: true,
      mayShareWatchHistory: true,
      answersSavedForTeachers: true,
      liveQuestionShowsName: true,
      insightsBeyondAggregates: true,
      gatherPhotoNeedsHostTick: true,
      waitingForGrownUp: false,
      mayWatch: true,
    }
  }
  const waiting = band === 'under-13' && waitingForGuardian
  return {
    mayShareWithLearners: false,
    mayShareWatchHistory: false,
    answersSavedForTeachers: band === '13-17' || !waiting,
    liveQuestionShowsName: false,
    insightsBeyondAggregates: false,
    gatherPhotoNeedsHostTick: true,
    waitingForGrownUp: waiting,
    mayWatch: true,
  }
}

export function liveQuestionName(band: AgeBand | null | undefined, name: string) {
  return childDefaults(band).liveQuestionShowsName ? name : 'A learner asks'
}

export function childShareRefusal(defaults: ChildDefaults, want: { shareWithLearners?: boolean; shareWatch?: boolean; shareWithTeacher?: boolean }) {
  if (want.shareWithLearners && !defaults.mayShareWithLearners) {
    return 'Sharing with other learners is off for you. Your words stay with you and your teacher.'
  }
  if (want.shareWatch && !defaults.mayShareWatchHistory) {
    return 'Watch history stays on this phone for you. Teachers only see which parts you finished.'
  }
  if (want.shareWithTeacher && !defaults.answersSavedForTeachers) {
    return 'Your answers stay with you until a grown-up agrees. You can still watch.'
  }
  return null
}

export const AGE_LABEL: Record<AgeBand, string> = {
  'under-13': 'Under 13',
  '13-17': '13 to 17',
  '18+': '18 or over',
}
