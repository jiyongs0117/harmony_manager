'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface BulkMemberRow {
  name: string
  gender?: string | null
  group_number?: string | null
  date_of_birth?: string | null
  choir_join_date?: string | null
  church_registration_date?: string | null
  church_position?: string | null
  mission_association_name?: string | null
  mission_association_position?: string | null
  address?: string | null
  phone_number?: string | null
  prayer_request?: string | null
}

const VALID_GENDERS = ['남', '여']
const VALID_POSITIONS = ['장로', '안수집사', '집사', '평신도']

function validateRow(row: BulkMemberRow, index: number): string | null {
  if (!row.name || row.name.trim().length === 0) {
    return `${index + 1}행: 이름이 비어있습니다`
  }
  if (row.gender && !VALID_GENDERS.includes(row.gender)) {
    return `${index + 1}행: 성별은 '남' 또는 '여'만 가능합니다 (입력값: ${row.gender})`
  }
  if (row.church_position && !VALID_POSITIONS.includes(row.church_position)) {
    return `${index + 1}행: 교회직분은 '장로', '안수집사', '집사', '평신도'만 가능합니다 (입력값: ${row.church_position})`
  }
  return null
}

export async function createMembersBulk(rows: BulkMemberRow[]) {
  if (!rows || rows.length === 0) {
    return { error: '업로드할 데이터가 없습니다' }
  }

  if (rows.length > 200) {
    return { error: '한 번에 최대 200명까지 업로드할 수 있습니다' }
  }

  // Validate all rows
  const errors: string[] = []
  for (let i = 0; i < rows.length; i++) {
    const err = validateRow(rows[i], i)
    if (err) errors.push(err)
  }

  if (errors.length > 0) {
    return { error: errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n...외 ${errors.length - 5}건` : '') }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증되지 않은 사용자입니다' }

  const { data: leader } = await supabase
    .from('leaders')
    .select('id, department, part')
    .eq('auth_user_id', user.id)
    .single()

  if (!leader) return { error: '파트장 정보를 찾을 수 없습니다' }

  const insertData = rows.map((row) => ({
    name: row.name.trim(),
    gender: row.gender || null,
    group_number: row.group_number || null,
    date_of_birth: row.date_of_birth || null,
    choir_join_date: row.choir_join_date || null,
    church_registration_date: row.church_registration_date || null,
    church_position: row.church_position || null,
    mission_association_name: row.mission_association_name || null,
    mission_association_position: row.mission_association_position || null,
    address: row.address || null,
    phone_number: row.phone_number || null,
    prayer_request: row.prayer_request || null,
    department: leader.department,
    part: leader.part,
    created_by: leader.id,
  }))

  const { error } = await supabase.from('members').insert(insertData)

  if (error) {
    return { error: '단원 일괄 등록에 실패했습니다: ' + error.message }
  }

  revalidatePath('/members')
  return { success: true, count: rows.length }
}
