'use client'

import { LeaderContext } from '@/hooks/use-leader'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Toaster } from '@/components/ui/toast'
import type { Leader } from '@/lib/types'

export function DashboardShell({
  leader,
  children,
}: {
  leader: Leader
  children: React.ReactNode
}) {
  return (
    <LeaderContext.Provider value={{ leader }}>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pb-20">{children}</main>
        <MobileNav />
        <Toaster />
      </div>
    </LeaderContext.Provider>
  )
}
