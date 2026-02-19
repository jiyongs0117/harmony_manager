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
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .or('status.eq.활동,status.is.null')
    .order('group_number')
    .order('name')

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
