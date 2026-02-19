import { createClient } from '@/lib/supabase/server'
import { FaceRecognition } from '@/components/members/face-recognition'
import type { MemberWithPhoto } from '@/hooks/use-face-recognition'
import type { AttendanceEvent } from '@/lib/types'

export default async function RecognizePage() {
  const supabase = await createClient()

  // face_descriptor 포함 조회 시도, 컬럼이 없으면 fallback
  let members: MemberWithPhoto[] = []
  const { data: membersWithDesc, error: descError } = await supabase
    .from('members')
    .select('id, name, department, part, group_number, photo_url, face_descriptor')
    .or('status.eq.활동,status.is.null')
    .not('photo_url', 'is', null)
    .order('name')

  if (descError) {
    // face_descriptor 컬럼이 없는 경우 fallback
    const { data: membersBasic } = await supabase
      .from('members')
      .select('id, name, department, part, group_number, photo_url')
      .or('status.eq.활동,status.is.null')
      .not('photo_url', 'is', null)
      .order('name')
    members = (membersBasic ?? []) as MemberWithPhoto[]
  } else {
    members = (membersWithDesc ?? []) as MemberWithPhoto[]
  }

  // 진행중인 출석 이벤트 조회
  let activeEvents: AttendanceEvent[] = []
  const { data: eventsData, error: eventsError } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('event_status', '진행중')
    .order('event_date', { ascending: false })

  if (!eventsError) {
    activeEvents = (eventsData ?? []) as AttendanceEvent[]
  }

  return (
    <FaceRecognition
      members={members}
      activeEvents={activeEvents}
    />
  )
}
