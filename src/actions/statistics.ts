'use server'

import { createClient } from '@/lib/supabase/server'
import { LONG_TERM_ABSENCE_THRESHOLD } from '@/lib/constants'
import type { MemberAttendanceStats, Member, AttendanceEvent, AttendanceRecord } from '@/lib/types'

export async function getAttendanceStats(): Promise<{
  totalMembers: number
  totalEvents: number
  averageRate: number
  memberStats: MemberAttendanceStats[]
}> {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('members')
    .select('id, name, photo_url, group_number')
    .eq('is_active', true)
    .order('name')

  const { data: events } = await supabase
    .from('attendance_events')
    .select('id, event_date')
    .order('event_date', { ascending: false })

  const { data: records } = await supabase
    .from('attendance_records')
    .select('member_id, event_id, status')

  if (!members || !events || !records) {
    return { totalMembers: 0, totalEvents: 0, averageRate: 0, memberStats: [] }
  }

  const totalMembers = members.length
  const totalEvents = events.length

  // 이벤트 ID를 날짜 순으로 정렬 (최신 먼저)
  const eventIds = events.map((e) => e.id)

  // 멤버별 통계 계산
  const memberStats: MemberAttendanceStats[] = members.map((member) => {
    const memberRecords = records.filter((r) => r.member_id === member.id)
    const presentCount = memberRecords.filter((r) => r.status === '출석').length
    const totalMemberEvents = memberRecords.length
    const attendanceRate = totalMemberEvents > 0
      ? Math.round((presentCount / totalMemberEvents) * 100)
      : 0

    // 연속 결석 수 계산 (최신 이벤트부터, 사전불참은 제외)
    let consecutiveAbsences = 0
    for (const eventId of eventIds) {
      const record = memberRecords.find((r) => r.event_id === eventId)
      if (!record || record.status === '결석') {
        consecutiveAbsences++
      } else {
        break
      }
    }

    return {
      member_id: member.id,
      member_name: member.name,
      photo_url: member.photo_url,
      group_number: member.group_number,
      total_events: totalMemberEvents,
      present_count: presentCount,
      attendance_rate: attendanceRate,
      consecutive_absences: consecutiveAbsences,
    }
  })

  const averageRate = memberStats.length > 0
    ? Math.round(memberStats.reduce((sum, s) => sum + s.attendance_rate, 0) / memberStats.length)
    : 0

  return { totalMembers, totalEvents, averageRate, memberStats }
}

export async function getLongTermAbsentees(): Promise<MemberAttendanceStats[]> {
  const { memberStats } = await getAttendanceStats()
  return memberStats
    .filter((s) => s.consecutive_absences >= LONG_TERM_ABSENCE_THRESHOLD)
    .sort((a, b) => b.consecutive_absences - a.consecutive_absences)
}

export async function getMemberAttendanceHistory(memberId: string): Promise<{
  member: Member | null
  history: { event: AttendanceEvent; record: AttendanceRecord | null }[]
}> {
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .single()

  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .order('event_date', { ascending: false })

  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('member_id', memberId)

  const history = (events ?? []).map((event) => ({
    event: event as AttendanceEvent,
    record: (records ?? []).find((r) => r.event_id === event.id) as AttendanceRecord | null,
  }))

  return { member: member as Member | null, history }
}
