import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MemberDetailCard } from '@/components/members/member-detail-card'
import type { Member } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MemberDetailPage({ params }: Props) {
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

  return <MemberDetailCard member={member as Member} />
}
