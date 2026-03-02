import { createServiceClient } from '@/lib/supabase/service'
import { FaceRegisterClient } from '@/components/face-register/face-register-client'

export default async function FaceRegisterPage() {
  const supabase = createServiceClient()

  // 활동 중인 단원의 조 목록 조회 (중복 제거)
  const { data } = await supabase
    .from('members')
    .select('group_number')
    .or('status.eq.활동,status.is.null')
    .not('group_number', 'is', null)
    .order('group_number')

  const groups = [
    ...new Set(
      (data ?? [])
        .map((m) => m.group_number as string)
        .filter(Boolean)
    ),
  ].sort()

  return <FaceRegisterClient groups={groups} />
}
