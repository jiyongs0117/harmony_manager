'use server'

import { createClient } from '@/lib/supabase/server'
import { memberSchema, type MemberFormData } from '@/lib/validations'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getLeaderInfo() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증되지 않은 사용자입니다')

  const { data: leader } = await supabase
    .from('leaders')
    .select('id, department, part')
    .eq('auth_user_id', user.id)
    .single()

  if (!leader) throw new Error('파트장 정보를 찾을 수 없습니다')
  return { supabase, leader }
}

export async function createMember(formData: MemberFormData) {
  const parsed = memberSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { supabase, leader } = await getLeaderInfo()

  const { error } = await supabase.from('members').insert({
    ...parsed.data,
    department: leader.department,
    part: leader.part,
    created_by: leader.id,
  })

  if (error) {
    return { error: '단원 등록에 실패했습니다: ' + error.message }
  }

  revalidatePath('/members')
  redirect('/members')
}

export async function updateMember(memberId: string, formData: MemberFormData) {
  const parsed = memberSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { supabase } = await getLeaderInfo()

  const { error } = await supabase
    .from('members')
    .update(parsed.data)
    .eq('id', memberId)

  if (error) {
    return { error: '단원 수정에 실패했습니다: ' + error.message }
  }

  revalidatePath('/members')
  revalidatePath(`/members/${memberId}`)
  redirect(`/members/${memberId}`)
}

export async function deleteMember(memberId: string) {
  const { supabase } = await getLeaderInfo()

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId)

  if (error) {
    return { error: '단원 삭제에 실패했습니다: ' + error.message }
  }

  revalidatePath('/members')
  redirect('/members')
}

export async function updateMemberStatus(memberId: string, status: string) {
  const { supabase } = await getLeaderInfo()

  const { error } = await supabase
    .from('members')
    .update({ status })
    .eq('id', memberId)

  if (error) {
    return { error: '상태 변경에 실패했습니다' }
  }

  revalidatePath('/members')
  revalidatePath(`/members/${memberId}`)
}
