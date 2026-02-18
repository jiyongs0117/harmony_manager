'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { deleteLeader } from '@/actions/leaders'
import type { Leader } from '@/lib/types'

interface LeaderCardProps {
  leader: Leader
  isCurrentUser: boolean
}

export function LeaderCard({ leader, isCurrentUser }: LeaderCardProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteLeader(leader.id)
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast('파트장이 삭제되었습니다', 'success')
        router.refresh()
      }
    } catch {
      toast('삭제 중 오류가 발생했습니다', 'error')
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{leader.name}</span>
            <Badge variant="info">{leader.department} {leader.part}</Badge>
            {leader.power && <Badge variant="warning">관리자</Badge>}
            {isCurrentUser && <Badge variant="success">나</Badge>}
          </div>
          <p className="text-xs text-muted mt-0.5 truncate">{leader.email}</p>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/admin/${leader.id}/edit`)}
          >
            수정
          </Button>
          {!isCurrentUser && (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() => setShowDeleteDialog(true)}
            >
              삭제
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="파트장 삭제"
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowDeleteDialog(false)}
            >
              취소
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              삭제
            </Button>
          </>
        }
      >
        <p><strong>{leader.name}</strong> 파트장을 삭제하시겠습니까?</p>
        <p className="mt-1">이 작업은 되돌릴 수 없습니다.</p>
      </Dialog>
    </>
  )
}
