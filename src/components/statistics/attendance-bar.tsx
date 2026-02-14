import { cn } from '@/lib/utils'

interface AttendanceBarProps {
  rate: number
  className?: string
}

export function AttendanceBar({ rate, className }: AttendanceBarProps) {
  return (
    <div className={cn('w-full bg-gray-100 rounded-full h-2', className)}>
      <div
        className={cn(
          'h-2 rounded-full transition-all',
          rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
        )}
        style={{ width: `${Math.min(rate, 100)}%` }}
      />
    </div>
  )
}
