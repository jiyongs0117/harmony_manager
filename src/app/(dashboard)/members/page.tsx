import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { MemberCard } from '@/components/members/member-card'
import { MemberFilters } from '@/components/members/member-filters'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Member } from '@/lib/types'

interface Props {
  searchParams: Promise<{ search?: string; group?: string; active?: string }>
}

export default async function MembersPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase.from('members').select('*').order('name')

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }
  if (params.group) {
    query = query.eq('group_number', params.group)
  }
  if (params.active === 'true') {
    query = query.eq('is_active', true)
  } else if (params.active === 'false') {
    query = query.eq('is_active', false)
  }

  const { data: members } = await query

  // 조 목록 추출 (필터용)
  const { data: allMembers } = await supabase
    .from('members')
    .select('group_number')
    .not('group_number', 'is', null)

  const groups = [...new Set(allMembers?.map((m) => m.group_number).filter(Boolean) as string[])].sort()

  return (
    <div>
      <PageHeader
        title="단원 관리"
        action={
          <div className="flex gap-2">
            <Link href="/members/upload">
              <Button size="sm" variant="secondary">엑셀 업로드</Button>
            </Link>
            <Link href="/members/new">
              <Button size="sm">+ 등록</Button>
            </Link>
          </div>
        }
      />

      <MemberFilters groups={groups} />

      {members && members.length > 0 ? (
        <div>
          <div className="px-4 py-2">
            <span className="text-xs text-muted">{members.length}명</span>
          </div>
          {(members as Member[]).map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="등록된 단원이 없습니다"
          description="새 단원을 등록해주세요"
          action={
            <Link href="/members/new">
              <Button size="sm">단원 등록</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
