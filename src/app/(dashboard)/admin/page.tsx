import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LeaderCard } from '@/components/admin/leader-card'
import Link from 'next/link'
import type { Leader } from '@/lib/types'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentLeader } = await supabase
    .from('leaders')
    .select('id, power')
    .eq('auth_user_id', user.id)
    .single()

  if (!currentLeader?.power) redirect('/members')

  const { data: leaders } = await supabase
    .from('leaders')
    .select('*')
    .order('department')
    .order('part')
    .order('name')

  return (
    <div>
      <PageHeader
        title="파트장 관리"
        action={
          <Link href="/admin/new">
            <Button size="sm">+ 파트장 추가</Button>
          </Link>
        }
      />

      {leaders && leaders.length > 0 ? (
        <div>
          <div className="px-4 py-2">
            <span className="text-xs text-muted">{leaders.length}명</span>
          </div>
          {(leaders as Leader[]).map((leader) => (
            <LeaderCard
              key={leader.id}
              leader={leader}
              isCurrentUser={leader.id === currentLeader.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="등록된 파트장이 없습니다"
          description="새 파트장을 추가해주세요"
          action={
            <Link href="/admin/new">
              <Button size="sm">파트장 추가</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
