import { getMemberAttendanceHistory } from '@/actions/statistics'
import { notFound } from 'next/navigation'
import { MemberHistoryTable } from '@/components/statistics/member-history-table'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AttendanceBar } from '@/components/statistics/attendance-bar'
import { getInitials } from '@/lib/utils'

interface Props {
  params: Promise<{ memberId: string }>
}

export default async function MemberHistoryPage({ params }: Props) {
  const { memberId } = await params
  const { member, history } = await getMemberAttendanceHistory(memberId)

  if (!member) {
    notFound()
  }

  const totalEvents = history.length
  const presentCount = history.filter((h) => h.record?.status === '출석').length
  const rate = totalEvents > 0 ? Math.round((presentCount / totalEvents) * 100) : 0

  return (
    <div>
      <div className="px-4 py-4">
        {/* 프로필 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center overflow-hidden">
            {member.photo_url ? (
              <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-semibold text-primary">
                {getInitials(member.name)}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{member.name}</h2>
            {member.group_number && (
              <span className="text-xs text-muted">{member.group_number}</span>
            )}
          </div>
        </div>

        {/* 요약 */}
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">출석률</span>
            <div className="flex items-center gap-2">
              <Badge variant={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'danger'}>
                {rate}%
              </Badge>
              <span className="text-sm text-muted">{presentCount}/{totalEvents}</span>
            </div>
          </div>
          <AttendanceBar rate={rate} />
        </Card>

        {/* 출석 이력 */}
        <h3 className="text-sm font-semibold text-foreground mb-2">출석 이력</h3>
      </div>
      <MemberHistoryTable history={history} />
    </div>
  )
}
