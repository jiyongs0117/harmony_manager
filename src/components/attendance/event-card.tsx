import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { AttendanceEvent } from '@/lib/types'

interface EventCardProps {
  event: AttendanceEvent
  presentCount: number
  totalCount: number
}

export function EventCard({ event, presentCount, totalCount }: EventCardProps) {
  const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0

  return (
    <Link href={`/attendance/${event.id}`}>
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border active:bg-gray-50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{event.event_name}</span>
            <Badge variant={event.event_status === '완료' ? 'default' : 'info'}>
              {event.event_status || '진행중'}
            </Badge>
            <Badge variant={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger'}>
              {rate}%
            </Badge>
          </div>
          <span className="text-xs text-muted mt-0.5 block">{formatDate(event.event_date)}</span>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-sm font-medium text-foreground">{presentCount}/{totalCount}</span>
          <span className="text-xs text-muted block">명 출석</span>
        </div>
        <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
