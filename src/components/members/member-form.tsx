'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { MemberPhotoUpload } from './member-photo-upload'
import { CHURCH_POSITIONS, GENDERS } from '@/lib/constants'
import { createMember, updateMember } from '@/actions/members'
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
  const [name, setName] = useState(member?.name ?? '')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const form = e.currentTarget
    const formData: MemberFormData = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      group_number: (form.elements.namedItem('group_number') as HTMLInputElement).value || null,
      date_of_birth: (form.elements.namedItem('date_of_birth') as HTMLInputElement).value || null,
      choir_join_date: (form.elements.namedItem('choir_join_date') as HTMLInputElement).value || null,
      church_registration_date: (form.elements.namedItem('church_registration_date') as HTMLInputElement).value || null,
      church_position: (form.elements.namedItem('church_position') as HTMLSelectElement).value as MemberFormData['church_position'] || null,
      mission_association_name: (form.elements.namedItem('mission_association_name') as HTMLInputElement).value || null,
      mission_association_position: (form.elements.namedItem('mission_association_position') as HTMLInputElement).value || null,
      gender: (form.elements.namedItem('gender') as HTMLSelectElement).value as MemberFormData['gender'] || null,
      address: (form.elements.namedItem('address') as HTMLInputElement).value || null,
      prayer_request: (form.elements.namedItem('prayer_request') as HTMLTextAreaElement).value || null,
      photo_url: photoUrl,
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
          onUpload={setPhotoUrl}
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
        <Input
          id="date_of_birth"
          name="date_of_birth"
          label="생년월일"
          type="date"
          defaultValue={member?.date_of_birth?.slice(0, 10) ?? ''}
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
            id="choir_join_date"
            name="choir_join_date"
            label="성가대 가입일"
            type="date"
            defaultValue={member?.choir_join_date?.slice(0, 10) ?? ''}
          />
          <Input
            id="church_registration_date"
            name="church_registration_date"
            label="교회 등록일"
            type="date"
            defaultValue={member?.church_registration_date?.slice(0, 10) ?? ''}
          />
        </div>
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
