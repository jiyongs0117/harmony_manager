import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { getInitials } from '@/lib/utils'
import type { Member } from '@/lib/types'

interface MemberCardProps {
  member: Member
}

export function MemberCard({ member }: MemberCardProps) {
  return (
    <Link href={`/members/${member.id}`}>
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border active:bg-gray-50 transition-colors">
        <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 overflow-hidden">
          {member.photo_url ? (
            <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-primary">
              {getInitials(member.name)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{member.name}</span>
            {!member.is_active && <Badge variant="danger">비활동</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {member.group_number && (
              <span className="text-xs text-muted">{member.group_number}</span>
            )}
            {member.church_position && (
              <span className="text-xs text-muted">{member.church_position}</span>
            )}
          </div>
        </div>
        <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
