import { z } from 'zod'

const emptyToNull = z.preprocess((val) => (val === '' ? null : val), z.string().nullable().optional())

export const memberSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  group_number: emptyToNull,
  date_of_birth: emptyToNull,
  choir_join_year: emptyToNull,
  church_registration_year: emptyToNull,
  church_position: emptyToNull,
  choir_role: emptyToNull,
  district: emptyToNull,
  area: emptyToNull,
  mission_association_name: emptyToNull,
  mission_association_position: emptyToNull,
  gender: emptyToNull,
  address: emptyToNull,
  phone_number: emptyToNull,
  prayer_request: emptyToNull,
  photo_url: emptyToNull,
})

export type MemberFormData = z.infer<typeof memberSchema>

export const eventSchema = z.object({
  event_name: z.string().min(1, '이벤트 이름을 입력해주세요'),
  event_date: z.string().min(1, '날짜를 선택해주세요'),
})

export type EventFormData = z.infer<typeof eventSchema>

export const leaderSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  name: z.string().min(1, '이름을 입력해주세요'),
  department: z.enum(['1부', '2부', '3부', '4부', '5부'], '부서를 선택해주세요'),
  part: z.enum(['소프라노', '알토', '테너', '베이스'], '파트를 선택해주세요'),
})

export type LeaderFormData = z.infer<typeof leaderSchema>
