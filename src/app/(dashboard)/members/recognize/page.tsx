import { createClient } from '@/lib/supabase/server'
import { FaceRecognition } from '@/components/members/face-recognition'
import type { MemberWithPhoto } from '@/hooks/use-face-recognition'
import type { AttendanceEvent } from '@/lib/types'

export default async function RecognizePage() {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('members')
    .select('id, name, department, part, group_number, photo_url, face_descriptor')
    .or('status.eq.활동,status.is.null')
    .not('photo_url', 'is', null)
    .order('name')

  // 진행중인 출석 이벤트 조회
  const { data: activeEvents } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('event_status', '진행중')
    .order('event_date', { ascending: false })

  return (
    <FaceRecognition
      members={(members ?? []) as MemberWithPhoto[]}
      activeEvents={(activeEvents ?? []) as AttendanceEvent[]}
    />
  )
}
