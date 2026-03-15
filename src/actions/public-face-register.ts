'use server'

import { createServiceClient } from '@/lib/supabase/service'

export interface MemberInfoInput {
  church_position?: string | null
  date_of_birth?: string | null
  district?: string | null
  area?: string | null
  church_registration_year?: string | null
  choir_join_year?: string | null
  address?: string | null
  prayer_request?: string | null
}

/**
 * 단원 개인 정보 업데이트 (인증 불필요 퍼블릭 액션)
 * 서비스 롤 키를 사용하여 RLS 우회
 */
export async function updateMemberInfo(
  memberId: string,
  info: MemberInfoInput,
): Promise<{ success?: boolean; error?: string }> {
  if (!memberId) return { error: '단원 ID가 없습니다.' }

  const supabase = createServiceClient()

  const updateData = Object.fromEntries(
    Object.entries(info).filter(([, v]) => v !== undefined),
  )

  if (Object.keys(updateData).length === 0) return { success: true }

  const { error } = await supabase
    .from('members')
    .update(updateData)
    .eq('id', memberId)

  if (error) {
    return { error: '정보 저장에 실패했습니다: ' + error.message }
  }

  return { success: true }
}

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
 * frontPhotoBase64가 제공되면 정면 사진을 member-photos 스토리지에 업로드 후 photo_url 저장
 */
export async function updateFaceDescriptors(
  memberId: string,
  descriptors: number[][],
  privacyConsent: boolean,
  frontPhotoBase64?: string,
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

  let photoUrl: string | undefined

  if (frontPhotoBase64) {
    try {
      const base64Data = frontPhotoBase64.replace(/^data:image\/jpeg;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(fileName, buffer, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('member-photos')
          .getPublicUrl(uploadData.path)
        photoUrl = urlData.publicUrl
      }
    } catch {
      // 사진 업로드 실패 시 얼굴 특징값 저장은 계속 진행
    }
  }

  const { error } = await supabase
    .from('members')
    .update({
      face_descriptors: descriptors,
      privacy_consent: privacyConsent,
      privacy_consent_at: new Date().toISOString(),
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    })
    .eq('id', memberId)

  if (error) {
    return { error: '저장에 실패했습니다: ' + error.message }
  }

  return { success: true }
}
