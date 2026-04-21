import { notFound, redirect } from 'next/navigation'
import { MemberDetailCard } from '@/components/members/member-detail-card'
import type { Member } from '@/lib/types'
import { getCurrentLeader, canAccessDeptPart } from '@/lib/auth/leader-context'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MemberDetailPage({ params }: Props) {
  const { id } = await params
  const { supabase, leader } = await getCurrentLeader()
  if (!leader) redirect('/login')

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) {
    notFound()
  }

  const m = member as Member
  if (!canAccessDeptPart(leader, m.department, m.part)) {
    redirect('/unauthorized')
  }

  return <MemberDetailCard member={m} />
}
