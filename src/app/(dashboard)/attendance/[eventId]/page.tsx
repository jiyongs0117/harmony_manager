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
    .eq('is_active', true)
    .order('name')

  // 기존 출석 기록
  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('event_id', eventId)

  return (
    <div>
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{(event as AttendanceEvent).event_name}</h2>
          <Badge>{formatDate((event as AttendanceEvent).event_date)}</Badge>
        </div>
      </div>
      <AttendanceChecklist
        eventId={eventId}
        members={(members ?? []) as Member[]}
        records={(records ?? []) as AttendanceRecord[]}
      />
    </div>
  )
}
