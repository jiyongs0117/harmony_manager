'use server'

import { createServiceClient } from '@/lib/supabase/service'

interface FoundMember {
  id: string
  name: string
  group_number: string | null
  part: string
  department: string
}

/**
 * 이름으로 단원 목록 검색 (2글자 이상, 최대 10명)
 */
export async function searchMembersByName(
  name: string,
): Promise<{ members?: FoundMember[]; error?: string }> {
  if (!name.trim() || name.trim().length < 2) {
    return { members: [] }
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('members')
    .select('id, name, group_number, part, department')
    .ilike('name', `%${name.trim()}%`)
    .or('status.eq.활동,status.is.null')
    .order('name')
    .limit(10)

  if (error) {
    return { error: '검색 중 오류가 발생했습니다.' }
  }

  return { members: data ?? [] }
}

/**
 * 다각도 얼굴 descriptor 배열 + 개인정보 동의 저장 (인증 불필요 퍼블릭 액션)
 * 서비스 롤 키를 사용하여 RLS 우회
 */
export async function updateFaceDescriptors(
  memberId: string,
  descriptors: number[][],
  privacyConsent: boolean,
): Promise<{ success?: boolean; error?: string }> {
  if (!memberId) {
    return { error: '단원 ID가 없습니다.' }
  }
  if (!descriptors || descriptors.length === 0) {
    return { error: '저장할 얼굴 특징값이 없습니다.' }
  }
  if (!descriptors.every((d) => d.length === 128)) {
    return { error: '얼굴 특징값 형식이 올바르지 않습니다.' }
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('members')
    .update({
      face_descriptors: descriptors,
      privacy_consent: privacyConsent,
      privacy_consent_at: new Date().toISOString(),
    })
    .eq('id', memberId)

  if (error) {
    return { error: '저장에 실패했습니다: ' + error.message }
  }

  return { success: true }
}
