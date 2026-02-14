'use client'

import { useState } from 'react'
import { StatusToggle } from './status-toggle'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { upsertAttendance } from '@/actions/attendance'
import { getInitials, cn } from '@/lib/utils'
import type { Member, AttendanceRecord, AttendanceStatus } from '@/lib/types'

interface AttendanceChecklistProps {
  eventId: string
  members: Member[]
  records: AttendanceRecord[]
}

export function AttendanceChecklist({ eventId, members, records }: AttendanceChecklistProps) {
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

  const presentCount = Array.from(statusMap.values()).filter((s) => s === '출석').length
  const totalCount = members.length

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

      {/* 체크리스트 */}
      <div className="divide-y divide-border">
        {members.map((member) => {
          const status = statusMap.get(member.id) ?? '결석'
          return (
            <div
              key={member.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                status === '사전불참' && 'bg-orange-50/50'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 overflow-hidden">
                {member.photo_url ? (
                  <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-primary">
                    {getInitials(member.name)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">{member.name}</span>
                {member.group_number && (
                  <span className="text-xs text-muted ml-1">{member.group_number}</span>
                )}
              </div>
              <StatusToggle
                status={status}
                onChange={(newStatus) => handleStatusChange(member.id, newStatus)}
              />
            </div>
          )
        })}
      </div>

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
    </div>
  )
}
