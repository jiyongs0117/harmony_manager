import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import type { MemberAttendanceStats } from '@/lib/types'

interface AbsenteeAlertListProps {
  absentees: MemberAttendanceStats[]
}

export function AbsenteeAlertList({ absentees }: AbsenteeAlertListProps) {
  if (absentees.length === 0) return null

  return (
    <div className="px-4 py-3">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        장기 결석자 ({absentees.length}명)
      </h3>
      <div className="space-y-2">
        {absentees.map((a) => (
          <Link key={a.member_id} href={`/statistics/members/${a.member_id}`}>
            <Card className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {a.photo_url ? (
                  <img src={a.photo_url} alt={a.member_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-red-500">
                    {getInitials(a.member_name)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{a.member_name}</span>
                {a.group_number && (
                  <span className="text-xs text-muted ml-1">{a.group_number}</span>
                )}
              </div>
              <Badge variant="danger">연속 {a.consecutive_absences}회 결석</Badge>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
