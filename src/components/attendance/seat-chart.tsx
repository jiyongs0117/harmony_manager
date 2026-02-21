'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { LEFT_SECTION, RIGHT_SECTION, LEFT_COLS, RIGHT_COLS } from '@/lib/seat-layout'
import { cn } from '@/lib/utils'
import type { Member, AttendanceStatus } from '@/lib/types'

interface SeatChartProps {
  members: Member[]
  statusMap: Map<string, AttendanceStatus>
  onStatusChange: (memberId: string, status: AttendanceStatus) => void
  open: boolean
  onClose: () => void
}

function getStatusColor(status: AttendanceStatus | undefined) {
  switch (status) {
    case '출석':
      return 'bg-green-500 text-white'
    case '결석':
      return 'bg-red-400 text-white'
    case '사전불참':
      return 'bg-orange-400 text-white'
    default:
      return 'bg-gray-200 text-gray-400'
  }
}

export function SeatChart({ members, statusMap, onStatusChange, open, onClose }: SeatChartProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [substituteMap, setSubstituteMap] = useState<Map<string, Member>>(new Map())
  const [selectingSeat, setSelectingSeat] = useState<string | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 좌석번호 → 멤버 매핑
  const seatToMember = new Map<string, Member>()
  members.forEach((m) => {
    if (m.seat_number) seatToMember.set(m.seat_number, m)
  })

  // 출석 체크된 멤버 중 좌석 미배정인 멤버 (대체 후보)
  const availableSubstitutes = members.filter((m) => {
    if (m.seat_number) return false
    const status = statusMap.get(m.id)
    return status === '출석'
  })

  // 이미 대체로 배정된 멤버 제외
  const assignedSubIds = new Set(Array.from(substituteMap.values()).map((m) => m.id))
  const filteredSubstitutes = availableSubstitutes.filter((m) => !assignedSubIds.has(m.id))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
      setSelectingSeat(null)
    }
  }, [open])

  // 좌석 출석 카운트 (좌석 배정된 멤버만)
  const seatMembers = members.filter((m) => m.seat_number)
  const seatPresent = seatMembers.filter((m) => statusMap.get(m.id) === '출석').length

  const handleLongPressStart = useCallback((seatNumber: string) => {
    const member = seatToMember.get(seatNumber)
    if (!member) return
    const status = statusMap.get(member.id)
    if (status === '출석') return // 출석인 좌석은 대체 불필요

    longPressTimer.current = setTimeout(() => {
      setSelectingSeat(seatNumber)
    }, 500)
  }, [seatToMember, statusMap])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleSelectSubstitute = (member: Member) => {
    if (!selectingSeat) return
    setSubstituteMap((prev) => {
      const next = new Map(prev)
      next.set(selectingSeat, member)
      return next
    })
    setSelectingSeat(null)
  }

  const handleRemoveSubstitute = (seatNumber: string) => {
    setSubstituteMap((prev) => {
      const next = new Map(prev)
      next.delete(seatNumber)
      return next
    })
  }

  const renderSeat = (seatNumber: string | null, key: string) => {
    if (seatNumber === null) {
      return <div key={key} className="w-11 h-11" />
    }

    const member = seatToMember.get(seatNumber)
    const substitute = substituteMap.get(seatNumber)
    const status = member ? statusMap.get(member.id) : undefined

    return (
      <button
        key={key}
        type="button"
        className={cn(
          'w-11 h-11 rounded text-center flex flex-col items-center justify-center relative transition-colors border border-white/20',
          member ? getStatusColor(status) : 'bg-gray-100 text-gray-300'
        )}
        onTouchStart={() => handleLongPressStart(seatNumber)}
        onTouchEnd={handleLongPressEnd}
        onMouseDown={() => handleLongPressStart(seatNumber)}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        disabled={!member}
      >
        <span className="text-[9px] leading-tight font-medium truncate w-full px-0.5">
          {member?.name || ''}
        </span>
        {substitute && (
          <span
            className="text-[7px] leading-tight text-yellow-200 truncate w-full px-0.5"
            onClick={(e) => {
              e.stopPropagation()
              handleRemoveSubstitute(seatNumber)
            }}
          >
            ↑{substitute.name}
          </span>
        )}
      </button>
    )
  }

  const renderSection = (section: (string | null)[][], cols: number, label: string) => (
    <div>
      <p className="text-[10px] text-gray-400 text-center mb-1">{label}</p>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, 2.75rem)` }}
      >
        {section.flatMap((row, ri) =>
          row.map((seat, ci) => renderSeat(seat, `${label}-${ri}-${ci}`))
        )}
      </div>
    </div>
  )

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="backdrop:bg-black/60 bg-white w-full h-full max-w-none max-h-none m-0 p-0"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button type="button" onClick={onClose} className="text-gray-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-semibold text-base">1층 좌석표</h2>
        <span className="text-xs text-gray-500">
          출석 <strong className="text-gray-900">{seatPresent}</strong>/{seatMembers.length}
        </span>
      </div>

      {/* Seat Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-4 justify-center items-start min-w-max">
          {renderSection(LEFT_SECTION, LEFT_COLS, '좌석 (왼쪽)')}
          <div className="w-px bg-gray-200 self-stretch" />
          {renderSection(RIGHT_SECTION, RIGHT_COLS, '좌석 (오른쪽)')}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500" /> 출석
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-400" /> 결석
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-400" /> 사전불참
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /> 빈좌석
          </span>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-2">
          길게 누르기: 대체 멤버 지정
        </p>
      </div>

      {/* 대체 멤버 선택 팝업 */}
      {selectingSeat && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
          onClick={() => setSelectingSeat(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-2xl max-h-[60vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                대체 멤버 선택
                <span className="text-xs text-gray-400 ml-2">
                  {seatToMember.get(selectingSeat)?.name} 자리
                </span>
              </h3>
              <button type="button" onClick={() => setSelectingSeat(null)} className="text-gray-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(60vh-48px)]">
              {filteredSubstitutes.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-400 text-center">
                  출석 체크된 좌석 미배정 멤버가 없습니다
                </p>
              ) : (
                filteredSubstitutes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectSubstitute(m)}
                    className="w-full px-4 py-3 text-left text-sm border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="font-medium">{m.name}</span>
                    {m.group_number && <span className="text-gray-400 text-xs">{m.group_number}조</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}
