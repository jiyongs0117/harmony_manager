export type Department = '1부' | '2부' | '3부' | '4부' | '5부'
export type Part = '소프라노' | '알토' | '테너' | '베이스'
export type ChurchPosition = '장로' | '안수집사' | '집사' | '평신도'
export type Gender = '남' | '여'
export type AttendanceStatus = '출석' | '결석' | '사전불참'

export interface Leader {
  id: string
  auth_user_id: string | null
  email: string
  name: string
  department: Department
  part: Part
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  name: string
  department: Department
  part: Part
  group_number: string | null
  date_of_birth: string | null
  choir_join_date: string | null
  church_registration_date: string | null
  church_position: ChurchPosition | null
  mission_association_name: string | null
  mission_association_position: string | null
  gender: Gender | null
  address: string | null
  prayer_request: string | null
  photo_url: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceEvent {
  id: string
  event_name: string
  event_date: string
  department: Department
  part: Part
  created_by: string
  created_at: string
  updated_at: string
}

export interface AttendanceRecord {
  id: string
  event_id: string
  member_id: string
  status: AttendanceStatus
  note: string | null
  created_at: string
  updated_at: string
}

export interface AttendanceRecordWithMember extends AttendanceRecord {
  member: Pick<Member, 'id' | 'name' | 'photo_url' | 'group_number'>
}

export interface EventWithStats extends AttendanceEvent {
  total_members: number
  present_count: number
  absent_count: number
  pre_absent_count: number
}

export interface MemberAttendanceStats {
  member_id: string
  member_name: string
  photo_url: string | null
  group_number: string | null
  total_events: number
  present_count: number
  attendance_rate: number
  consecutive_absences: number
}
