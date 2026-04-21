import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Department, Part } from '@/lib/types'

export interface LeaderContext {
  id: string
  department: Department
  part: Part
  power: boolean
}

/**
 * 현재 로그인한 파트장 정보를 조회한다.
 * 인증되지 않았거나 leaders 테이블에 등록되지 않은 경우 null.
 */
export async function getCurrentLeader(): Promise<{
  supabase: SupabaseClient
  leader: LeaderContext | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, leader: null }

  const { data: leader } = await supabase
    .from('leaders')
    .select('id, department, part, power')
    .eq('auth_user_id', user.id)
    .single()

  return { supabase, leader: (leader as LeaderContext | null) ?? null }
}

/**
 * 파트장이 관리자(power=true)인 경우 true — department/part 필터를 적용하지 않아도 됨.
 */
export function isAdmin(leader: LeaderContext): boolean {
  return leader.power === true
}

/**
 * 파트장이 해당 department/part 리소스에 접근할 수 있는지 검사.
 */
export function canAccessDeptPart(
  leader: LeaderContext,
  department: Department,
  part: Part
): boolean {
  if (leader.power) return true
  return leader.department === department && leader.part === part
}
