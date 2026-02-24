'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { extractDescriptorFromUrl } from '@/lib/face-extract'
import { updateFaceDescriptor } from '@/actions/members'

type SyncState = 'idle' | 'running' | 'done'

interface Progress {
  total: number
  current: number
  succeeded: number
  failed: number
  currentName: string
  failedNames: string[]
}

export function BulkDescriptorSync() {
  const [state, setState] = useState<SyncState>('idle')
  const [progress, setProgress] = useState<Progress | null>(null)

  const handleSync = async () => {
    setState('running')

    const supabase = createClient()

    // 사진은 있지만 face_descriptor가 없는 멤버 조회
    const { data: members, error } = await supabase
      .from('members')
      .select('id, name, photo_url')
      .not('photo_url', 'is', null)
      .is('face_descriptor', null)
      .or('status.eq.활동,status.is.null')
      .order('name')

    if (error || !members || members.length === 0) {
      setProgress({
        total: 0,
        current: 0,
        succeeded: 0,
        failed: 0,
        currentName: '',
        failedNames: [],
      })
      setState('done')
      return
    }

    const total = members.length
    let succeeded = 0
    let failed = 0
    const failedNames: string[] = []

    for (let i = 0; i < members.length; i++) {
      const member = members[i]

      setProgress({
        total,
        current: i + 1,
        succeeded,
        failed,
        currentName: member.name,
        failedNames: [...failedNames],
      })

      try {
        const result = await extractDescriptorFromUrl(member.photo_url!)
        if (result.success) {
          await updateFaceDescriptor(member.id, result.descriptor)
          succeeded++
        } else {
          // 얼굴 미감지 또는 분석 오류
          failed++
          failedNames.push(member.name)
        }
      } catch {
        failed++
        failedNames.push(member.name)
      }
    }

    setProgress({
      total,
      current: total,
      succeeded,
      failed,
      currentName: '',
      failedNames,
    })
    setState('done')
  }

  const handleReset = () => {
    setState('idle')
    setProgress(null)
  }

  if (state === 'idle') {
    return (
      <Button size="sm" variant="secondary" onClick={handleSync}>
        얼굴 특징점 일괄 추출
      </Button>
    )
  }

  if (state === 'running' && progress) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-muted">
            {progress.current}/{progress.total}명 처리 중
          </span>
          {progress.currentName && (
            <span className="text-xs text-muted truncate max-w-[120px]">
              {progress.currentName}
            </span>
          )}
        </div>
        {/* 진행 바 */}
        <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  if (state === 'done' && progress) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-foreground font-medium">
              완료: {progress.succeeded}명 성공
              {progress.failed > 0 && (
                <span className="text-destructive"> / {progress.failed}명 실패</span>
              )}
            </span>
            {progress.total === 0 && (
              <span className="text-xs text-muted">추출할 대상 없음</span>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={handleReset}>
            닫기
          </Button>
        </div>
        {progress.failedNames.length > 0 && (
          <div className="text-xs text-destructive text-right max-w-[260px]">
            <span className="font-medium">얼굴 미감지: </span>
            <span>{progress.failedNames.join(', ')}</span>
          </div>
        )}
      </div>
    )
  }

  return null
}
