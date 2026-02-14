import { Badge } from '@/components/ui/badge'
import { ATTENDANCE_STATUS_COLORS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { AttendanceEvent, AttendanceRecord, AttendanceStatus } from '@/lib/types'

interface MemberHistoryTableProps {
  history: { event: AttendanceEvent; record: AttendanceRecord | null }[]
}

export function MemberHistoryTable({ history }: MemberHistoryTableProps) {
  if (history.length === 0) {
    return <p className="text-sm text-muted text-center py-8">출석 기록이 없습니다</p>
  }

  return (
    <div className="divide-y divide-border">
      {history.map(({ event, record }) => (
        <div key={event.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <span className="text-sm font-medium text-foreground">{event.event_name}</span>
            <span className="text-xs text-muted block mt-0.5">{formatDate(event.event_date)}</span>
          </div>
          <Badge
            className={record ? ATTENDANCE_STATUS_COLORS[record.status as AttendanceStatus] : 'bg-gray-100 text-gray-500'}
          >
            {record ? record.status : '기록없음'}
          </Badge>
        </div>
      ))}
    </div>
  )
}
