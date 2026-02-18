'use server'

import { createClient } from '@/lib/supabase/server'
import { leaderSchema, type LeaderFormData } from '@/lib/validations'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getAdminInfo() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증되지 않은 사용자입니다')

  const { data: leader } = await supabase
    .from('leaders')
    .select('id, power')
    .eq('auth_user_id', user.id)
    .single()

  if (!leader || !leader.power) throw new Error('관리자 권한이 없습니다')
  return { supabase, leader }
}

export async function getLeaders() {
  const { supabase } = await getAdminInfo()

  const { data, error } = await supabase
    .from('leaders')
    .select('*')
    .order('department')
    .order('part')
    .order('name')

  if (error) {
    return { error: '파트장 목록 조회에 실패했습니다: ' + error.message, data: null }
  }

  return { data, error: null }
}

export async function getLeaderById(leaderId: string) {
  const { supabase } = await getAdminInfo()

  const { data, error } = await supabase
    .from('leaders')
    .select('*')
    .eq('id', leaderId)
    .single()

  if (error) {
    return { error: '파트장 정보 조회에 실패했습니다', data: null }
  }

  return { data, error: null }
}

export async function createLeader(formData: LeaderFormData) {
  const parsed = leaderSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { supabase } = await getAdminInfo()

  const { error } = await supabase.from('leaders').insert({
    email: parsed.data.email,
    name: parsed.data.name,
    department: parsed.data.department,
    part: parsed.data.part,
  })

  if (error) {
    if (error.message.includes('duplicate')) {
      return { error: '이미 등록된 이메일입니다' }
    }
    return { error: '파트장 등록에 실패했습니다: ' + error.message }
  }

  revalidatePath('/admin')
  redirect('/admin')
}

export async function updateLeader(leaderId: string, formData: LeaderFormData) {
  const parsed = leaderSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { supabase } = await getAdminInfo()

  const { error } = await supabase
    .from('leaders')
    .update({
      email: parsed.data.email,
      name: parsed.data.name,
      department: parsed.data.department,
      part: parsed.data.part,
    })
    .eq('id', leaderId)

  if (error) {
    if (error.message.includes('duplicate')) {
      return { error: '이미 등록된 이메일입니다' }
    }
    return { error: '파트장 수정에 실패했습니다: ' + error.message }
  }

  revalidatePath('/admin')
  redirect('/admin')
}

export async function deleteLeader(leaderId: string) {
  const { supabase, leader } = await getAdminInfo()

  if (leader.id === leaderId) {
    return { error: '자기 자신은 삭제할 수 없습니다' }
  }

  const { error } = await supabase
    .from('leaders')
    .delete()
    .eq('id', leaderId)

  if (error) {
    return { error: '파트장 삭제에 실패했습니다: ' + error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}
