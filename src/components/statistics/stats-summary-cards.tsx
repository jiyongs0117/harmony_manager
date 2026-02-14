import { Card } from '@/components/ui/card'

interface StatsSummaryCardsProps {
  totalMembers: number
  totalEvents: number
  averageRate: number
}

export function StatsSummaryCards({ totalMembers, totalEvents, averageRate }: StatsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-3">
      <Card className="text-center py-3">
        <span className="text-2xl font-bold text-foreground">{totalMembers}</span>
        <span className="text-xs text-muted block mt-0.5">활동 단원</span>
      </Card>
      <Card className="text-center py-3">
        <span className="text-2xl font-bold text-foreground">{totalEvents}</span>
        <span className="text-xs text-muted block mt-0.5">총 이벤트</span>
      </Card>
      <Card className="text-center py-3">
        <span className="text-2xl font-bold text-primary">{averageRate}%</span>
        <span className="text-xs text-muted block mt-0.5">평균 출석률</span>
      </Card>
    </div>
  )
}
