'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { deleteMember, toggleMemberActive } from '@/actions/members'
import { formatDate, getInitials } from '@/lib/utils'
import type { Member } from '@/lib/types'

interface MemberDetailCardProps {
  member: Member
}

export function MemberDetailCard({ member }: MemberDetailCardProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteMember(member.id)
      if (result?.error) {
        toast(result.error, 'error')
        setIsDeleting(false)
      }
    } catch {
      // redirect
    }
  }

  const handleToggleActive = async () => {
    const result = await toggleMemberActive(member.id, !member.is_active)
    if (result?.error) {
      toast(result.error, 'error')
    } else {
      toast(member.is_active ? '비활동으로 변경되었습니다' : '활동으로 변경되었습니다')
      router.refresh()
    }
  }

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-foreground font-medium">{value || '-'}</span>
    </div>
  )

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 프로필 상단 */}
      <div className="flex flex-col items-center pt-2">
        <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center overflow-hidden mb-3">
          {member.photo_url ? (
            <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-semibold text-primary">
              {getInitials(member.name)}
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold">{member.name}</h2>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={member.is_active ? 'success' : 'danger'}>
            {member.is_active ? '활동' : '비활동'}
          </Badge>
          {member.group_number && <Badge>{member.group_number}</Badge>}
        </div>
      </div>

      {/* 기본 정보 */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">기본 정보</h3>
        <InfoRow label="성별" value={member.gender} />
        <InfoRow label="생년월일" value={formatDate(member.date_of_birth)} />
        <InfoRow label="휴대폰번호" value={member.phone_number} />
        <InfoRow label="주소" value={member.address} />
      </Card>

      {/* 교회 정보 */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">교회 정보</h3>
        <InfoRow label="교회 직분" value={member.church_position} />
        <InfoRow label="성가대 가입일" value={formatDate(member.choir_join_date)} />
        <InfoRow label="교회 등록일" value={formatDate(member.church_registration_date)} />
        <InfoRow label="소속 선교회" value={member.mission_association_name} />
        <InfoRow label="선교회 직분" value={member.mission_association_position} />
      </Card>

      {/* 기도제목 */}
      {member.prayer_request && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">기도제목</h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{member.prayer_request}</p>
        </Card>
      )}

      {/* 액션 버튼들 */}
      <div className="space-y-2 pt-2">
        <Link href={`/members/${member.id}/edit`} className="block">
          <Button variant="primary" className="w-full">수정</Button>
        </Link>
        <Button variant="secondary" className="w-full" onClick={handleToggleActive}>
          {member.is_active ? '비활동으로 변경' : '활동으로 변경'}
        </Button>
        <Button variant="danger" className="w-full" onClick={() => setShowDeleteDialog(true)}>
          삭제
        </Button>
      </div>

      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="단원 삭제"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteDialog(false)}>
              취소
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isDeleting}>
              삭제
            </Button>
          </>
        }
      >
        <p><strong>{member.name}</strong> 단원을 삭제하시겠습니까?</p>
        <p className="mt-1">이 작업은 되돌릴 수 없으며, 출석 기록도 함께 삭제됩니다.</p>
      </Dialog>
    </div>
  )
}
