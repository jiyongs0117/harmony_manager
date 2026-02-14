'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface MemberFiltersProps {
  groups: string[]
}

export function MemberFilters({ groups }: MemberFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }
      return params.toString()
    },
    [searchParams]
  )

  return (
    <div className="px-4 py-3 space-y-2 bg-card border-b border-border">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          placeholder="이름으로 검색"
          defaultValue={searchParams.get('search') ?? ''}
          onChange={(e) => {
            router.push(`/members?${createQueryString('search', e.target.value)}`)
          }}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex gap-2">
        <select
          defaultValue={searchParams.get('group') ?? ''}
          onChange={(e) => {
            router.push(`/members?${createQueryString('group', e.target.value)}`)
          }}
          className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">전체 조</option>
          {groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          defaultValue={searchParams.get('active') ?? ''}
          onChange={(e) => {
            router.push(`/members?${createQueryString('active', e.target.value)}`)
          }}
          className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">전체 상태</option>
          <option value="true">활동</option>
          <option value="false">비활동</option>
        </select>
      </div>
    </div>
  )
}
