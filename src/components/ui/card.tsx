import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border p-4 shadow-sm',
        onClick && 'cursor-pointer active:bg-gray-50 transition-colors',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
