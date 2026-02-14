'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { createEvent } from '@/actions/attendance'
import { EVENT_PRESETS } from '@/lib/constants'
import { getToday, cn } from '@/lib/utils'

export function EventForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState(getToday())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventName || !eventDate) return

    setIsSubmitting(true)
    try {
      const result = await createEvent({ event_name: eventName, event_date: eventDate })
      if (result?.error) {
        toast(result.error, 'error')
        setIsSubmitting(false)
      }
    } catch {
      // redirect
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
      <Input
        id="event_date"
        label="날짜"
        type="date"
        value={eventDate}
        onChange={(e) => setEventDate(e.target.value)}
        required
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">예배/이벤트</label>
        <div className="flex flex-wrap gap-2">
          {EVENT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setEventName(preset)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                eventName === preset
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-foreground border-border hover:bg-gray-50'
              )}
            >
              {preset}
            </button>
          ))}
        </div>
        <Input
          id="event_name"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="직접 입력"
          required
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => router.back()}
        >
          취소
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          isLoading={isSubmitting}
        >
          생성 및 출석 체크
        </Button>
      </div>
    </form>
  )
}
