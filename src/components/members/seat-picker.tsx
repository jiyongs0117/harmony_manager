'use client'

import { useState, useRef, useEffect } from 'react'
import { LEFT_SECTION, RIGHT_SECTION, LEFT_COLS, RIGHT_COLS } from '@/lib/seat-layout'
import { cn } from '@/lib/utils'

interface SeatPickerProps {
  value: string | null
  onChange: (seatNumber: string | null) => void
}

export function SeatPicker({ value, onChange }: SeatPickerProps) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  const handleSelect = (seatNumber: string) => {
    if (value === seatNumber) {
      onChange(null) // 같은 좌석 다시 클릭하면 해제
    } else {
      onChange(seatNumber)
    }
    setOpen(false)
  }

  const renderSeat = (seatNumber: string | null, key: string) => {
    if (seatNumber === null) {
      return <div key={key} className="w-10 h-10" />
    }

    const isSelected = value === seatNumber

    return (
      <button
        key={key}
        type="button"
        onClick={() => handleSelect(seatNumber)}
        className={cn(
          'w-10 h-10 rounded text-[8px] font-medium flex items-center justify-center transition-colors border',
          isSelected
            ? 'bg-primary text-white border-primary'
            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 active:bg-primary-light'
        )}
      >
        {seatNumber.replace('L-', '').replace('R-', '')}
      </button>
    )
  }

  const renderSection = (section: (string | null)[][], cols: number, label: string) => (
    <div>
      <p className="text-[10px] text-gray-400 text-center mb-1">{label}</p>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, 2.5rem)` }}
      >
        {section.flatMap((row, ri) =>
          row.map((seat, ci) => renderSeat(seat, `${label}-${ri}-${ci}`))
        )}
      </div>
    </div>
  )

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">좌석번호</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left px-3 py-2.5 rounded-lg border border-border bg-white text-sm hover:bg-gray-50 transition-colors"
      >
        {value ? (
          <span className="text-foreground font-medium">{value}</span>
        ) : (
          <span className="text-muted">좌석표에서 선택</span>
        )}
      </button>
      {/* hidden input for form submission */}
      <input type="hidden" name="seat_number" value={value ?? ''} />

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="backdrop:bg-black/60 bg-white w-full h-full max-w-none max-h-none m-0 p-0"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button type="button" onClick={() => setOpen(false)} className="text-gray-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-semibold text-base">좌석 선택</h2>
          <div className="w-6" />
        </div>

        {/* Seat Grid */}
        <div className="overflow-auto p-4">
          <div className="flex gap-4 justify-center items-start min-w-max">
            {renderSection(LEFT_SECTION, LEFT_COLS, '왼쪽')}
            <div className="w-px bg-gray-200 self-stretch" />
            {renderSection(RIGHT_SECTION, RIGHT_COLS, '오른쪽')}
          </div>

          {value && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false) }}
                className="text-xs text-red-500 font-medium px-3 py-1.5 rounded hover:bg-red-50"
              >
                좌석 해제
              </button>
            </div>
          )}

          <p className="text-[10px] text-gray-400 text-center mt-3">
            좌석을 클릭하여 선택하세요
          </p>
        </div>
      </dialog>
    </div>
  )
}
