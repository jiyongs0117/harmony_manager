import { z } from 'zod'

export const memberSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요'),
  group_number: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  choir_join_date: z.string().optional().nullable(),
  church_registration_date: z.string().optional().nullable(),
  church_position: z.enum(['장로', '안수집사', '집사', '평신도']).optional().nullable(),
  mission_association_name: z.string().optional().nullable(),
  mission_association_position: z.string().optional().nullable(),
  gender: z.enum(['남', '여']).optional().nullable(),
  address: z.string().optional().nullable(),
  prayer_request: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
})

export type MemberFormData = z.infer<typeof memberSchema>

export const eventSchema = z.object({
  event_name: z.string().min(1, '이벤트 이름을 입력해주세요'),
  event_date: z.string().min(1, '날짜를 선택해주세요'),
})

export type EventFormData = z.infer<typeof eventSchema>
