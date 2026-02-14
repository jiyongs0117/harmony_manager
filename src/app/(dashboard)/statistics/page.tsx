import { getAttendanceStats, getLongTermAbsentees } from '@/actions/statistics'
import { PageHeader } from '@/components/layout/page-header'
import { StatsSummaryCards } from '@/components/statistics/stats-summary-cards'
import { AbsenteeAlertList } from '@/components/statistics/absentee-alert-list'
import { AttendanceBar } from '@/components/statistics/attendance-bar'
import { Card } from '@/components/ui/card'
import { getInitials } from '@/lib/utils'
import Link from 'next/link'

export default async function StatisticsPage() {
  const { totalMembers, totalEvents, averageRate, memberStats } = await getAttendanceStats()
  const absentees = await getLongTermAbsentees()

  // 출석률 순 정렬
  const sortedStats = [...memberStats].sort((a, b) => a.attendance_rate - b.attendance_rate)

  return (
    <div>
      <PageHeader title="통계" />

      <StatsSummaryCards
        totalMembers={totalMembers}
        totalEvents={totalEvents}
        averageRate={averageRate}
      />

      <AbsenteeAlertList absentees={absentees} />

      {/* 단원별 출석률 */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground mb-3">단원별 출석률</h3>
        <div className="space-y-2">
          {sortedStats.map((stat) => (
            <Link key={stat.member_id} href={`/statistics/members/${stat.member_id}`}>
              <Card className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {stat.photo_url ? (
                    <img src={stat.photo_url} alt={stat.member_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-primary">
                      {getInitials(stat.member_name)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">{stat.member_name}</span>
                    <span className="text-xs font-medium text-muted">{stat.attendance_rate}%</span>
                  </div>
                  <AttendanceBar rate={stat.attendance_rate} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
