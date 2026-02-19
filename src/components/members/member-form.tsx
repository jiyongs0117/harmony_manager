'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { MemberPhotoUpload } from './member-photo-upload'
import { SeatPicker } from './seat-picker'
import { CHURCH_POSITIONS, GENDERS, MEMBER_STATUSES } from '@/lib/constants'
import { createMember, updateMember, updateFaceDescriptor } from '@/actions/members'
import { extractDescriptorFromUrl } from '@/lib/face-extract'
import { toast } from '@/components/ui/toast'
import type { Member } from '@/lib/types'
import type { MemberFormData } from '@/lib/validations'

interface MemberFormProps {
  member?: Member
  mode: 'create' | 'edit'
}

export function MemberForm({ member, mode }: MemberFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(member?.photo_url ?? null)
  const [photoChanged, setPhotoChanged] = useState(false)
  const [name, setName] = useState(member?.name ?? '')
  const [seatNumber, setSeatNumber] = useState<string | null>(member?.seat_number ?? null)

  const handlePhotoChange = (url: string | null) => {
    setPhotoUrl(url)
    setPhotoChanged(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const form = e.currentTarget
    const getValue = (fieldName: string) =>
      (form.elements.namedItem(fieldName) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)?.value ?? ''

    const formData = {
      name: getValue('name'),
      group_number: getValue('group_number'),
      date_of_birth: getValue('date_of_birth'),
      choir_join_year: getValue('choir_join_year'),
      church_registration_year: getValue('church_registration_year'),
      church_position: getValue('church_position'),
      choir_role: getValue('choir_role'),
      district: getValue('district'),
      area: getValue('area'),
      mission_association_name: getValue('mission_association_name'),
      mission_association_position: getValue('mission_association_position'),
      gender: getValue('gender'),
      address: getValue('address'),
      phone_number: getValue('phone_number'),
      prayer_request: getValue('prayer_request'),
      photo_url: photoUrl,
      seat_number: seatNumber,
    }

    try {
      let result
      if (mode === 'create') {
        result = await createMember(formData)
      } else {
        result = await updateMember(member!.id, formData)
      }

      if (result?.error) {
        toast(result.error, 'error')
        setIsSubmitting(false)
        return
      }

      // 사진이 변경된 경우 face descriptor 추출 & 저장 (백그라운드)
      if (photoChanged && mode === 'edit' && member) {
        if (photoUrl) {
          extractDescriptorFromUrl(photoUrl).then(async (desc) => {
            await updateFaceDescriptor(member.id, desc)
          })
        } else {
          updateFaceDescriptor(member.id, null)
        }
      }
    } catch {
      // redirect throws, this is expected
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6">
      {/* 사진 */}
      <div className="flex justify-center">
        <MemberPhotoUpload
          currentUrl={photoUrl}
          memberName={name}
          onUpload={handlePhotoChange}
        />
      </div>

      {/* 기본 정보 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">기본 정보</h3>
        <Input
          id="name"
          name="name"
          label="이름 *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="이름을 입력하세요"
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="gender"
            name="gender"
            label="성별"
            placeholder="선택"
            defaultValue={member?.gender ?? ''}
            options={GENDERS.map((g) => ({ value: g, label: g }))}
          />
          <Input
            id="group_number"
            name="group_number"
            label="조"
            defaultValue={member?.group_number ?? ''}
            placeholder="예: 1조"
          />
        </div>
        <SeatPicker value={seatNumber} onChange={setSeatNumber} />
        <Input
          id="date_of_birth"
          name="date_of_birth"
          label="생년월일"
          defaultValue={member?.date_of_birth ?? ''}
          placeholder="예: 1990-01-01"
        />
      </section>

      {/* 교회 정보 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">교회 정보</h3>
        <Select
          id="church_position"
          name="church_position"
          label="교회 직분"
          placeholder="선택"
          defaultValue={member?.church_position ?? ''}
          options={CHURCH_POSITIONS.map((p) => ({ value: p, label: p }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="district"
            name="district"
            label="교구"
            defaultValue={member?.district ?? ''}
            placeholder="예: 1교구"
          />
          <Input
            id="area"
            name="area"
            label="구역"
            defaultValue={member?.area ?? ''}
            placeholder="예: 1구역"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="choir_join_year"
            name="choir_join_year"
            label="성가대 가입년도"
            defaultValue={member?.choir_join_year ?? ''}
            placeholder="예: 2020"
          />
          <Input
            id="church_registration_year"
            name="church_registration_year"
            label="교회 등록년도"
            defaultValue={member?.church_registration_year ?? ''}
            placeholder="예: 2015"
          />
        </div>
        <Input
          id="choir_role"
          name="choir_role"
          label="성가대 직책"
          defaultValue={member?.choir_role ?? ''}
          placeholder="예: 회장, 부회장, 총무"
        />
        <Input
          id="mission_association_name"
          name="mission_association_name"
          label="소속 선교회"
          defaultValue={member?.mission_association_name ?? ''}
          placeholder="선교회 이름"
        />
        <Input
          id="mission_association_position"
          name="mission_association_position"
          label="선교회 직분"
          defaultValue={member?.mission_association_position ?? ''}
          placeholder="선교회에서의 직분"
        />
      </section>

      {/* 연락처 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">연락처</h3>
        <Input
          id="phone_number"
          name="phone_number"
          label="휴대폰번호"
          type="tel"
          defaultValue={member?.phone_number ?? ''}
          placeholder="010-0000-0000"
        />
        <Input
          id="address"
          name="address"
          label="주소"
          defaultValue={member?.address ?? ''}
          placeholder="주소를 입력하세요"
        />
      </section>

      {/* 기도제목 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">기도제목</h3>
        <Textarea
          id="prayer_request"
          name="prayer_request"
          defaultValue={member?.prayer_request ?? ''}
          placeholder="기도제목을 입력하세요"
          rows={4}
        />
      </section>

      {/* 버튼 */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => router.back()}
        >
          취소
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          isLoading={isSubmitting}
        >
          {mode === 'create' ? '등록' : '저장'}
        </Button>
      </div>
    </form>
  )
}
