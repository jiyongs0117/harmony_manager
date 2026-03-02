import { createClient } from '@supabase/supabase-js'
import { FaceRegisterClient } from '@/components/face-register/face-register-client'

// 빌드 시 정적 생성 방지 (런타임에서만 실행)
export const dynamic = 'force-dynamic'

export default async function FaceRegisterPage() {
  // 조 목록 조회는 anon 키로 충분 (읽기 전용)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

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
