export const BULK_ACTIONS = ['give-course', 'assign-plan', 'move-code', 'add-class', 'pause', 'restore', 'email', 'export'] as const

export type BulkAction = (typeof BULK_ACTIONS)[number]

export type BulkPlan = {
  action: BulkAction
  ids: number[]
  courseId?: number
  codeId?: number
  classId?: number
  planName?: string
  start?: string
  end?: string
  weekdays?: number[]
  reason?: string
}

export function parseIdList(raw: unknown) {
  if (Array.isArray(raw)) return [...new Set(raw.map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0))]
  if (typeof raw === 'string') {
    return [...new Set(raw.split(/[\s,]+/).map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0))]
  }
  const one = Number(raw)
  return Number.isInteger(one) && one > 0 ? [one] : []
}

export function bulkConfirmLine(count: number, action: BulkAction) {
  const verb: Record<BulkAction, string> = {
    'give-course': 'give a course to',
    'assign-plan': 'give a study plan to',
    'move-code': 'move',
    'add-class': 'add',
    pause: 'pause',
    restore: 'restore',
    email: 'email',
    export: 'download',
  }
  const noun = count === 1 ? '1 person' : `${count} people`
  return `This will ${verb[action]} ${noun}.`
}

export function bulkProblems(plan: BulkPlan) {
  const problems: string[] = []
  if (!BULK_ACTIONS.includes(plan.action)) problems.push('Choose what to do.')
  if (!plan.ids.length) problems.push('Tick the people this should change.')
  if (plan.action === 'give-course' && !plan.courseId) problems.push('Choose a course.')
  if (plan.action === 'move-code' && !plan.codeId) problems.push('Choose an access code.')
  if (plan.action === 'add-class' && !plan.classId) problems.push('Choose a class.')
  if (plan.action === 'assign-plan' && (!plan.start || !plan.end)) problems.push('A study plan needs a start and an end date.')
  if ((plan.action === 'pause' || plan.action === 'restore') && !(plan.reason || '').trim()) {
    problems.push('Write a short reason. It is kept on the activity log.')
  }
  return problems
}

export function bulkConfirmValue() {
  return 'yes'
}

export function bulkEventKind(action: BulkAction) {
  return action
}
