'use server'

import { LONG_TERM_ABSENCE_THRESHOLD } from '@/lib/constants'
import { getCurrentLeader, isAdmin, canAccessDeptPart } from '@/lib/auth/leader-context'
import type { MemberAttendanceStats, Member, AttendanceEvent, AttendanceRecord } from '@/lib/types'

export async function getAttendanceStats(): Promise<{
  totalMembers: number
  totalEvents: number
  averageRate: number
  memberStats: MemberAttendanceStats[]
}> {
  const { supabase, leader } = await getCurrentLeader()
  if (!leader) {
    return { totalMembers: 0, totalEvents: 0, averageRate: 0, memberStats: [] }
  }

  let membersQuery = supabase
    .from('members')
    .select('id, name, photo_url, group_number')
    .or('status.eq.활동,status.is.null')
    .order('name')
  if (!isAdmin(leader)) {
    membersQuery = membersQuery.eq('department', leader.department).eq('part', leader.part)
  }
  const { data: members } = await membersQuery

  let eventsQuery = supabase
    .from('attendance_events')
    .select('id, event_date')
    .order('event_date', { ascending: false })
  if (!isAdmin(leader)) {
    eventsQuery = eventsQuery.eq('department', leader.department).eq('part', leader.part)
  }
  const { data: events } = await eventsQuery

  // records 는 event_id 기준으로 필터 (leader의 dept/part 이벤트에 속하는 기록만)
  const eventIdsForFilter = (events ?? []).map((e) => e.id)
  let records: { member_id: string; event_id: string; status: string }[] = []
  if (eventIdsForFilter.length > 0) {
    const { data } = await supabase
      .from('attendance_records')
      .select('member_id, event_id, status')
      .in('event_id', eventIdsForFilter)
    records = (data ?? []) as typeof records
  }

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
  const { supabase, leader } = await getCurrentLeader()
  if (!leader) return { member: null, history: [] }

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', memberId)
    .single()

  if (!member) return { member: null, history: [] }

  const m = member as Member
  if (!canAccessDeptPart(leader, m.department, m.part)) {
    return { member: null, history: [] }
  }

  let histEventsQuery = supabase
    .from('attendance_events')
    .select('*')
    .order('event_date', { ascending: false })
  if (!isAdmin(leader)) {
    histEventsQuery = histEventsQuery
      .eq('department', leader.department)
      .eq('part', leader.part)
  }
  const { data: events } = await histEventsQuery

  const { data: records } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('member_id', memberId)

  const history = (events ?? []).map((event) => ({
    event: event as AttendanceEvent,
    record: (records ?? []).find((r) => r.event_id === event.id) as AttendanceRecord | null,
  }))

  return { member: m, history }
}
