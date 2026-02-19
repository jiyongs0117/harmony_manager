'use client'

import { useState } from 'react'
import { StatusToggle } from './status-toggle'
import { SeatChart } from './seat-chart'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { upsertAttendance, updateEventStatus } from '@/actions/attendance'
import { getInitials, cn } from '@/lib/utils'
import type { Member, AttendanceRecord, AttendanceStatus, EventStatus } from '@/lib/types'

interface AttendanceChecklistProps {
  eventId: string
  eventStatus: EventStatus
  members: Member[]
  records: AttendanceRecord[]
}

export function AttendanceChecklist({ eventId, eventStatus, members, records }: AttendanceChecklistProps) {
  const [statusMap, setStatusMap] = useState<Map<string, AttendanceStatus>>(() => {
    const map = new Map<string, AttendanceStatus>()
    // 기존 레코드로 초기화
    records.forEach((r) => map.set(r.member_id, r.status))
    // 레코드 없는 단원은 결석으로 초기화
    members.forEach((m) => {
      if (!map.has(m.id)) {
        map.set(m.id, '결석')
      }
    })
    return map
  })
  const [isSaving, setIsSaving] = useState(false)
  const [showSeatChart, setShowSeatChart] = useState(false)
  const [currentEventStatus, setCurrentEventStatus] = useState<EventStatus>(eventStatus)
  const [isStatusChanging, setIsStatusChanging] = useState(false)

  const handleStatusChange = (memberId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => {
      const next = new Map(prev)
      next.set(memberId, status)
      return next
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    const recordsToSave = Array.from(statusMap.entries()).map(([member_id, status]) => ({
      member_id,
      status,
    }))

    const result = await upsertAttendance(eventId, recordsToSave)
    setIsSaving(false)

    if (result.error) {
      toast(result.error, 'error')
    } else {
      toast('출석이 저장되었습니다')
    }
  }

  // 전체 출석/결석 버튼
  const handleSetAll = (status: AttendanceStatus) => {
    setStatusMap((prev) => {
      const next = new Map(prev)
      members.forEach((m) => next.set(m.id, status))
      return next
    })
  }

  const handleEventStatusChange = async () => {
    const newStatus: EventStatus = currentEventStatus === '진행중' ? '완료' : '진행중'
    setIsStatusChanging(true)
    const result = await updateEventStatus(eventId, newStatus)
    setIsStatusChanging(false)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      setCurrentEventStatus(newStatus)
      toast(newStatus === '완료' ? '출석부가 완료되었습니다' : '출석부가 진행중으로 변경되었습니다')
    }
  }

  const presentCount = Array.from(statusMap.values()).filter((s) => s === '출석').length
  const totalCount = members.length

  // 조별 그룹핑
  const grouped = members.reduce<Record<string, Member[]>>((acc, member) => {
    const group = member.group_number || '미배정'
    if (!acc[group]) acc[group] = []
    acc[group].push(member)
    return acc
  }, {})

  // 조 번호 순 정렬 (미배정은 맨 뒤)
  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    if (a === '미배정') return 1
    if (b === '미배정') return -1
    return Number(a) - Number(b)
  })

  return (
    <div>
      {/* 요약 바 */}
      <div className="sticky top-14 z-30 bg-card border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-sm text-muted">
          출석 <strong className="text-foreground">{presentCount}</strong> / {totalCount}명
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowSeatChart(true)}
            className="text-xs text-primary font-medium px-2 py-1 rounded hover:bg-primary-light"
          >
            1층 좌석표
          </button>
          <button
            type="button"
            onClick={() => handleSetAll('출석')}
            className="text-xs text-green-600 font-medium px-2 py-1 rounded hover:bg-green-50"
          >
            전체출석
          </button>
          <button
            type="button"
            onClick={() => handleSetAll('결석')}
            className="text-xs text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50"
          >
            전체결석
          </button>
        </div>
      </div>

      {/* 상태 변경 바 */}
      <div className="px-4 py-2 border-b border-border bg-card flex items-center justify-end">
        <button
          type="button"
          onClick={handleEventStatusChange}
          disabled={isStatusChanging}
          className={cn(
            'text-xs font-medium px-3 py-1.5 rounded transition-colors',
            currentEventStatus === '진행중'
              ? 'text-blue-600 hover:bg-blue-50'
              : 'text-orange-600 hover:bg-orange-50',
            isStatusChanging && 'opacity-50'
          )}
        >
          {isStatusChanging
            ? '변경 중...'
            : currentEventStatus === '진행중'
              ? '✓ 출석부 완료하기'
              : '↩ 진행중으로 되돌리기'}
        </button>
      </div>

      {/* 조별 체크리스트 */}
      {sortedGroups.map((group) => (
        <div key={group}>
          <div className="sticky top-[105px] z-20 bg-gray-50 px-4 py-1.5 border-b border-border">
            <span className="text-xs font-semibold text-muted">{group === '미배정' ? '미배정' : `${group}조`}</span>
          </div>
          <div className="divide-y divide-border">
            {grouped[group].map((member) => {
              const status = statusMap.get(member.id) ?? '결석'
              return (
                <div
                  key={member.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    status === '사전불참' && 'bg-orange-50/50'
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-primary">
                        {getInitials(member.name)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{member.name}</span>
                  </div>
                  <StatusToggle
                    status={status}
                    onChange={(newStatus) => handleStatusChange(member.id, newStatus)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* 고정 저장 버튼 */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pb-safe">
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          className="w-full"
          size="lg"
        >
          저장하기
        </Button>
      </div>

      {/* 1층 좌석표 */}
      <SeatChart
        members={members}
        statusMap={statusMap}
        onStatusChange={handleStatusChange}
        open={showSeatChart}
        onClose={() => setShowSeatChart(false)}
      />
    </div>
  )
}
