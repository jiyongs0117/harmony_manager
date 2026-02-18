import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LeaderForm } from '@/components/admin/leader-form'
import type { Leader } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditLeaderPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentLeader } = await supabase
    .from('leaders')
    .select('id, power')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentLeader?.power) redirect('/members')

  const { data: leader } = await supabase
    .from('leaders')
    .select('*')
    .eq('id', id)
    .single()

  if (!leader) notFound()

  return (
    <div>
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">파트장 수정</h2>
      </div>
      <LeaderForm mode="edit" leader={leader as Leader} />
    </div>
  )
}
