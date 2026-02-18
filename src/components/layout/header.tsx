'use client'

import { useLeader } from '@/hooks/use-leader'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function Header() {
  const leader = useLeader()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border pt-safe">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">성가대 관리</h1>
          <Badge variant="info">{leader.department} {leader.part}</Badge>
        </div>
        <div className="flex items-center gap-3">
          {leader.power && (
            <button
              onClick={() => router.push('/admin')}
              className="text-sm text-primary font-medium hover:text-primary-hover transition-colors"
            >
              관리자
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  )
}
