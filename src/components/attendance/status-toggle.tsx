'use client'

import { cn } from '@/lib/utils'
import type { AttendanceStatus } from '@/lib/types'

interface StatusToggleProps {
  status: AttendanceStatus
  onChange: (status: AttendanceStatus) => void
}

const statusConfig: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: '출석', label: '출석', activeClass: 'bg-green-500 text-white' },
  { value: '결석', label: '결석', activeClass: 'bg-red-500 text-white' },
  { value: '사전불참', label: '사전', activeClass: 'bg-orange-400 text-white' },
]

export function StatusToggle({ status, onChange }: StatusToggleProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {statusConfig.map((config) => (
        <button
          key={config.value}
          type="button"
          onClick={() => onChange(config.value)}
          className={cn(
            'px-2.5 py-1.5 text-xs font-medium transition-colors min-w-[44px]',
            status === config.value
              ? config.activeClass
              : 'bg-white text-muted hover:bg-gray-50'
          )}
        >
          {config.label}
        </button>
      ))}
    </div>
  )
}
