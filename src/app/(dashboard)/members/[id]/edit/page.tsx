import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MemberForm } from '@/components/members/member-form'
import type { Member } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditMemberPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) {
    notFound()
  }

  return (
    <div>
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">단원 수정</h2>
      </div>
      <MemberForm mode="edit" member={member as Member} />
    </div>
  )
}
