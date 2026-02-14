'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let addToastFn: ((toast: Omit<Toast, 'id'>) => void) | null = null

export function toast(message: string, type: Toast['type'] = 'success') {
  addToastFn?.({ message, type })
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    addToastFn = (toast) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { ...toast, id }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3000)
    }
    return () => {
      addToastFn = null
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-[slideDown_0.2s_ease-out]',
            t.type === 'success' && 'bg-green-600 text-white',
            t.type === 'error' && 'bg-red-600 text-white',
            t.type === 'info' && 'bg-blue-600 text-white'
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
