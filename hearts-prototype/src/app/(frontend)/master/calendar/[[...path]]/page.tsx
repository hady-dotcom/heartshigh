import { requireMaster } from '@/server/context'
import { CalendarPages } from '@/screens/desk/calendar'

export default async function MasterCalendar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams
  const { payload, user } = await requireMaster()
  return CalendarPages({ master: { payload, user, query } })
}
