import type { Department, Part, ChurchPosition, Gender, AttendanceStatus } from '@/lib/types'

export const DEPARTMENTS: Department[] = ['1부', '2부', '3부', '4부', '5부']

export const PARTS: Part[] = ['소프라노', '알토', '테너', '베이스']

export const CHURCH_POSITIONS: ChurchPosition[] = ['장로', '안수집사', '집사', '평신도']

export const GENDERS: Gender[] = ['남', '여']

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['출석', '결석', '사전불참']

export const EVENT_PRESETS = [
  '새벽예배',
  '주일예배',
  '주일저녁예배',
  '수요예배',
  '금요기도회',
  '연습',
] as const

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  '출석': 'bg-green-100 text-green-800',
  '결석': 'bg-red-100 text-red-800',
  '사전불참': 'bg-orange-100 text-orange-800',
}

export const LONG_TERM_ABSENCE_THRESHOLD = 3
