import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AttendanceChecklist } from '@/components/attendance/attendance-checklist'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { AttendanceEvent, Member, AttendanceRecord } from '@/lib/types'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function AttendanceChecklistPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()

  // 이벤트 정보
  const { data: event } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) {
    notFound()
  }

  // 활동 중인 단원 목록
  const { data: rawMembers } = await supabase
    .from('members')
    .select('*')
    .or('status.eq.활동,status.is.null')
    .order('name')

  // 조 번호 자연 정렬: "1", "2-A", "2-B", "3-A", ..., "10"
  const naturalCompare = (a: string | null, b: string | null) => {
    if (!a && !b) return 0
    if (!a) return 1
    if (!b) return -1
    const re = /(\d+)|(\D+)/g
    const ca = a.match(re) ?? []
    const cb = b.match(re) ?? []
    const len = Math.min(ca.length, cb.length)
    for (let i = 0; i < len; i++) {
      const sa = ca[i]
      const sb = cb[i]
      const na = parseInt(sa, 10)
      const nb = parseInt(sb, 10)
      if (!isNaN(na) && !isNaN(nb)) {
        if (na !== nb) return na - nb
      } else {
        const cmp = sa.localeCompare(sb)
        if (cmp !== 0) return cmp
      }
    }
    return ca.length - cb.length
  }

  const members = rawMembers?.slice().sort((a, b) => {
    const g = naturalCompare(a.group_number, b.group_number)
    if (g !== 0) return g
    return (a.name ?? '').localeCompare(b.name ?? '')
  })

  // 기존 출석 기록
  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('event_id', eventId)

  const typedEvent = event as AttendanceEvent

  return (
    <div>
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{typedEvent.event_name}</h2>
          <Badge>{formatDate(typedEvent.event_date)}</Badge>
          <Badge variant={typedEvent.event_status === '완료' ? 'default' : 'info'}>
            {typedEvent.event_status || '진행중'}
          </Badge>
        </div>
      </div>
      <AttendanceChecklist
        eventId={eventId}
        eventStatus={typedEvent.event_status || '진행중'}
        members={(members ?? []) as Member[]}
        records={(records ?? []) as AttendanceRecord[]}
      />
    </div>
  )
}
