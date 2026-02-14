import { EventForm } from '@/components/attendance/event-form'

export default function NewEventPage() {
  return (
    <div>
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">출석 이벤트 생성</h2>
      </div>
      <EventForm />
    </div>
  )
}
