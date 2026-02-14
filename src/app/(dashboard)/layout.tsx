import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from './dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 파트장 정보 조회
  const { data: leader } = await supabase
    .from('leaders')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  if (!leader) {
    redirect('/unauthorized')
  }

  return <DashboardShell leader={leader}>{children}</DashboardShell>
}
