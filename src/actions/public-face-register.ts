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
 * 조 + 이름으로 단원 검색 (인증 불필요 퍼블릭 액션)
 */
export async function findMemberByNameAndGroup(
  name: string,
  groupNumber: string,
): Promise<{ member?: FoundMember; error?: string }> {
  if (!name.trim() || !groupNumber.trim()) {
    return { error: '이름과 조를 모두 입력해주세요.' }
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('members')
    .select('id, name, group_number, part, department')
    .eq('name', name.trim())
    .eq('group_number', groupNumber.trim())
    .or('status.eq.활동,status.is.null')
    .maybeSingle()

  if (error) {
    return { error: '검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }
  }

  if (!data) {
    return { error: '해당 단원을 찾을 수 없습니다. 이름과 조를 다시 확인해주세요.' }
  }

  return { member: data }
}

/**
 * 다각도 얼굴 descriptor 배열 저장 (인증 불필요 퍼블릭 액션)
 * 서비스 롤 키를 사용하여 RLS 우회
 */
export async function updateFaceDescriptors(
  memberId: string,
  descriptors: number[][],
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
    .update({ face_descriptors: descriptors })
    .eq('id', memberId)

  if (error) {
    return { error: '저장에 실패했습니다: ' + error.message }
  }

  return { success: true }
}
