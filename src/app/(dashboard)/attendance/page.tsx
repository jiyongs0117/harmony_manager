import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { EventCard } from '@/components/attendance/event-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { AttendanceEvent } from '@/lib/types'

export default async function AttendancePage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })

  // 각 이벤트별 출석 통계 조회
  const eventStats = await Promise.all(
    (events ?? []).map(async (event) => {
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('event_id', event.id)

      const total = records?.length ?? 0
      const present = records?.filter((r) => r.status === '출석').length ?? 0

      return { eventId: event.id, presentCount: present, totalCount: total }
    })
  )

  const statsMap = new Map(eventStats.map((s) => [s.eventId, s]))

  return (
    <div>
      <PageHeader
        title="출석 관리"
        action={
          <Link href="/attendance/new">
            <Button size="sm">+ 새 출석</Button>
          </Link>
        }
      />

      {events && events.length > 0 ? (
        <div>
          {(events as AttendanceEvent[]).map((event) => {
            const stats = statsMap.get(event.id)
            return (
              <EventCard
                key={event.id}
                event={event}
                presentCount={stats?.presentCount ?? 0}
                totalCount={stats?.totalCount ?? 0}
              />
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="출석 기록이 없습니다"
          description="새 출석 이벤트를 생성해주세요"
          action={
            <Link href="/attendance/new">
              <Button size="sm">출석 이벤트 생성</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
