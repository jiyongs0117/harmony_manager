'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DEPARTMENTS, PARTS } from '@/lib/constants'
import { createLeader, updateLeader } from '@/actions/leaders'
import { toast } from '@/components/ui/toast'
import type { Leader } from '@/lib/types'
import type { LeaderFormData } from '@/lib/validations'

interface LeaderFormProps {
  leader?: Leader
  mode: 'create' | 'edit'
}

export function LeaderForm({ leader, mode }: LeaderFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const form = e.currentTarget
    const formData: LeaderFormData = {
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      department: (form.elements.namedItem('department') as HTMLSelectElement).value as LeaderFormData['department'],
      part: (form.elements.namedItem('part') as HTMLSelectElement).value as LeaderFormData['part'],
    }

    try {
      let result
      if (mode === 'create') {
        result = await createLeader(formData)
      } else {
        result = await updateLeader(leader!.id, formData)
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
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">기본 정보</h3>
        <Input
          id="name"
          name="name"
          label="이름 *"
          required
          defaultValue={leader?.name ?? ''}
          placeholder="파트장 이름"
        />
        <Input
          id="email"
          name="email"
          label="이메일 *"
          type="email"
          required
          defaultValue={leader?.email ?? ''}
          placeholder="Google 로그인 이메일"
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">소속 정보</h3>
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="department"
            name="department"
            label="부서 *"
            required
            placeholder="선택"
            defaultValue={leader?.department ?? ''}
            options={DEPARTMENTS.map((d) => ({ value: d, label: d }))}
          />
          <Select
            id="part"
            name="part"
            label="파트 *"
            required
            placeholder="선택"
            defaultValue={leader?.part ?? ''}
            options={PARTS.map((p) => ({ value: p, label: p }))}
          />
        </div>
      </section>

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
