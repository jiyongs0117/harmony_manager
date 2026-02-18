'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import type { Member } from '@/lib/types'

interface MemberListProps {
  members: Member[]
}

export function MemberList({ members }: MemberListProps) {
  const router = useRouter()

  return (
    <div className="border border-border rounded-lg overflow-hidden mx-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-border">
              <th className="px-3 py-2.5 text-left font-medium text-muted whitespace-nowrap">조</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted whitespace-nowrap">이름</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted whitespace-nowrap">직분</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted whitespace-nowrap">성가대직책</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                onClick={() => router.push(`/members/${member.id}`)}
                className="border-b border-border last:border-0 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2.5 whitespace-nowrap text-foreground">{member.group_number || '-'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {member.photo_url ? (
                        <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-primary">{getInitials(member.name)}</span>
                      )}
                    </span>
                    {member.name}
                    {member.status && member.status !== '활동' && <Badge variant="danger">{member.status}</Badge>}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-foreground">{member.church_position || '-'}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-foreground">{member.choir_role || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
