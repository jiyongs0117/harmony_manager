'use client'

import { createContext, useContext } from 'react'
import type { Leader } from '@/lib/types'

interface LeaderContextType {
  leader: Leader
}

export const LeaderContext = createContext<LeaderContextType | null>(null)

export function useLeader() {
  const context = useContext(LeaderContext)
  if (!context) {
    throw new Error('useLeader must be used within a LeaderProvider')
  }
  return context.leader
}
