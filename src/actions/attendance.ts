'use server'

import { createClient } from '@/lib/supabase/server'
import { eventSchema, type EventFormData } from '@/lib/validations'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { AttendanceStatus, EventStatus } from '@/lib/types'

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

export async function createEvent(formData: EventFormData) {
  const parsed = eventSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { supabase, leader } = await getLeaderInfo()

  const { data: event, error } = await supabase
    .from('attendance_events')
    .insert({
      event_name: parsed.data.event_name,
      event_date: parsed.data.event_date,
      event_status: '진행중' as EventStatus,
      department: leader.department,
      part: leader.part,
      created_by: leader.id,
    })
    .select('id')
    .single()

  if (error) {
    return { error: '이벤트 생성에 실패했습니다: ' + error.message }
  }

  // 활동 중인 모든 단원에 대해 기본 결석 레코드 생성
  const { data: members } = await supabase
    .from('members')
    .select('id')
    .or('status.eq.활동,status.is.null')

  if (members && members.length > 0) {
    const records = members.map((m) => ({
      event_id: event.id,
      member_id: m.id,
      status: '결석' as AttendanceStatus,
    }))

    await supabase.from('attendance_records').insert(records)
  }

  revalidatePath('/attendance')
  redirect(`/attendance/${event.id}`)
}

export async function deleteEvent(eventId: string) {
  const { supabase } = await getLeaderInfo()

  const { error } = await supabase
    .from('attendance_events')
    .delete()
    .eq('id', eventId)

  if (error) {
    return { error: '이벤트 삭제에 실패했습니다' }
  }

  revalidatePath('/attendance')
  redirect('/attendance')
}

export async function updateEventStatus(eventId: string, eventStatus: EventStatus) {
  const { supabase } = await getLeaderInfo()

  const { error } = await supabase
    .from('attendance_events')
    .update({ event_status: eventStatus })
    .eq('id', eventId)

  if (error) {
    return { error: '상태 변경에 실패했습니다: ' + error.message }
  }

  revalidatePath('/attendance')
  revalidatePath(`/attendance/${eventId}`)
  return { success: true }
}

export async function upsertAttendance(
  eventId: string,
  records: { member_id: string; status: AttendanceStatus }[]
) {
  const { supabase } = await getLeaderInfo()

  const upsertData = records.map((r) => ({
    event_id: eventId,
    member_id: r.member_id,
    status: r.status,
  }))

  const { error } = await supabase
    .from('attendance_records')
    .upsert(upsertData, { onConflict: 'event_id,member_id' })

  if (error) {
    return { error: '출석 저장에 실패했습니다: ' + error.message }
  }

  revalidatePath('/attendance')
  revalidatePath(`/attendance/${eventId}`)
  revalidatePath('/statistics')
  return { success: true }
}
