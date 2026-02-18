import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeaderForm } from '@/components/admin/leader-form'

export default async function NewLeaderPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentLeader } = await supabase
    .from('leaders')
    .select('id, power')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentLeader?.power) redirect('/members')

  return (
    <div>
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">파트장 등록</h2>
      </div>
      <LeaderForm mode="create" />
    </div>
  )
}
