'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFaceRecognition, type MemberWithPhoto } from '@/hooks/use-face-recognition'
import { upsertAttendance } from '@/actions/attendance'
import { updateFaceDescriptor } from '@/actions/members'
import { extractDescriptorFromUrl } from '@/lib/face-extract'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import { cn, getInitials } from '@/lib/utils'
import type { AttendanceEvent } from '@/lib/types'

interface FaceRecognitionProps {
  members: MemberWithPhoto[]
  activeEvents?: AttendanceEvent[]
}

export function FaceRecognition({ members, activeEvents = [] }: FaceRecognitionProps) {
  const router = useRouter()
  const {
    status,
    progress,
    skippedMembers,
    matches,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    flipCamera,
    errorMessage,
  } = useFaceRecognition(members)

  // Auto-start camera when ready
  useEffect(() => {
    if (status === 'ready') {
      startCamera('environment')
    }
  }, [status, startCamera])

  // Notify skipped members
  useEffect(() => {
    if (status === 'ready' && skippedMembers.length > 0) {
      toast(
        `${members.length}명 중 ${members.length - skippedMembers.length}명 등록 완료 (${skippedMembers.length}명 얼굴 미감지)`,
        'info'
      )
    }
  }, [status, skippedMembers, members.length])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const [selectedEventId, setSelectedEventId] = useState<string>(activeEvents[0]?.id ?? '')
  const [checkedMembers, setCheckedMembers] = useState<Set<string>>(new Set())
  const [isChecking, setIsChecking] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })

  // DB에 face_descriptor가 없는 멤버 수
  const membersWithoutDescriptor = members.filter(
    (m) => !m.face_descriptor || m.face_descriptor.length !== 128
  )

  const handleSyncDescriptors = async () => {
    const targets = membersWithoutDescriptor
    if (targets.length === 0) {
      toast('모든 단원의 특징값이 이미 저장되어 있습니다', 'info')
      return
    }
    setIsSyncing(true)
    setSyncProgress({ current: 0, total: targets.length })

    let successCount = 0
    for (let i = 0; i < targets.length; i++) {
      const member = targets[i]
      const desc = await extractDescriptorFromUrl(member.photo_url)
      if (desc) {
        const result = await updateFaceDescriptor(member.id, desc)
        if (result.success) successCount++
      }
      setSyncProgress({ current: i + 1, total: targets.length })
    }

    setIsSyncing(false)
    toast(`${successCount}명의 특징값 저장 완료`)
  }

  const handleAttendanceCheck = async (memberId: string) => {
    if (!selectedEventId) {
      toast('진행중인 출석부가 없습니다', 'error')
      return
    }
    if (checkedMembers.has(memberId)) {
      toast('이미 출석 처리되었습니다', 'info')
      return
    }
    setIsChecking(true)
    const result = await upsertAttendance(selectedEventId, [
      { member_id: memberId, status: '출석', checked_at: new Date().toISOString() },
    ])
    setIsChecking(false)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      setCheckedMembers((prev) => new Set(prev).add(memberId))
      toast('출석 처리되었습니다 ✓')
    }
  }

  const bestMatch = matches.length > 0
    ? matches.reduce((best, m) => (m.distance < best.distance ? m : best), matches[0])
    : null

  return (
    <div className="flex flex-col h-[100dvh] bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <button
          onClick={() => {
            stopCamera()
            router.back()
          }}
          className="text-white text-sm font-medium"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-semibold">얼굴 인식</h1>
        <div className="flex items-center gap-3">
          {membersWithoutDescriptor.length > 0 && !isSyncing && (
            <button
              onClick={handleSyncDescriptors}
              className="text-xs text-yellow-300 font-medium px-2 py-1 border border-yellow-300/50 rounded-lg"
              disabled={status === 'loading-models' || status === 'building-descriptors'}
            >
              특징값 저장 ({membersWithoutDescriptor.length})
            </button>
          )}
          {isSyncing && (
            <span className="text-xs text-yellow-300">
              {syncProgress.current}/{syncProgress.total}
            </span>
          )}
          <button
            onClick={flipCamera}
            className="text-white"
            disabled={status !== 'detecting'}
          >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
            <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
            <path d="m14 9 3-3 3 3" />
            <path d="m10 15-3 3-3-3" />
          </svg>
        </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="relative overflow-hidden" style={{ height: '55dvh' }}>
        {/* Loading models */}
        {status === 'loading-models' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
            <LoadingSpinner size="lg" className="text-white" />
            <p className="text-white text-sm">얼굴 인식 모델 로딩 중...</p>
          </div>
        )}

        {/* Building descriptors */}
        {status === 'building-descriptors' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8">
            <p className="text-white text-sm">
              단원 사진 분석 중... ({progress.current}/{progress.total})
            </p>
            <div className="w-full max-w-xs bg-white/20 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{
                  width: progress.total > 0
                    ? `${(progress.current / progress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-white text-sm text-center">{errorMessage}</p>
            <Button
              size="sm"
              onClick={() => window.location.reload()}
            >
              다시 시도
            </Button>
          </div>
        )}

        {/* No members with photos */}
        {status === 'ready' && members.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8">
            <p className="text-white text-sm text-center">
              사진이 등록된 단원이 없습니다.
              <br />
              단원 등록 시 사진을 추가해주세요.
            </p>
            <Button size="sm" onClick={() => router.push('/members')}>
              단원 관리로 이동
            </Button>
          </div>
        )}

        {/* Camera view */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            'w-full h-full object-cover',
            (status !== 'detecting' && status !== 'ready') && 'hidden'
          )}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />

        {/* Hint overlay */}
        {(status === 'detecting' || status === 'ready') && matches.length === 0 && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center">
            <div className="bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full animate-pulse">
              얼굴을 카메라에 비춰주세요
            </div>
          </div>
        )}
      </div>

      {/* Match result card */}
      {bestMatch && (
        <div className="bg-white safe-bottom flex-1 overflow-y-auto">
          {/* 진행중 출석부 선택 (2개 이상일 때만 표시) */}
          {activeEvents.length > 1 && (
            <div className="px-4 pt-3 pb-1">
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-gray-50"
              >
                {activeEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.event_name} ({ev.event_date})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => {
                stopCamera()
                router.push(`/members/${bestMatch.member.id}`)
              }}
              className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center"
            >
              {bestMatch.member.photo_url ? (
                <img
                  src={bestMatch.member.photo_url}
                  alt={bestMatch.member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-semibold text-muted">
                  {getInitials(bestMatch.member.name)}
                </span>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => {
                  stopCamera()
                  router.push(`/members/${bestMatch.member.id}`)
                }}
                className="text-left"
              >
                <div className="flex items-baseline gap-2">
                  {bestMatch.member.group_number && (
                    <span className="text-lg font-bold text-muted">{bestMatch.member.group_number}조</span>
                  )}
                  <p className="font-bold text-2xl">{bestMatch.member.name}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge>{bestMatch.member.department}</Badge>
                  <Badge>{bestMatch.member.part}</Badge>
                </div>
              </button>
            </div>
            {activeEvents.length > 0 && (
              <button
                onClick={() => handleAttendanceCheck(bestMatch.member.id)}
                disabled={isChecking || checkedMembers.has(bestMatch.member.id)}
                className={cn(
                  'flex-shrink-0 px-4 py-3 rounded-xl text-sm font-bold transition-colors',
                  checkedMembers.has(bestMatch.member.id)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary text-white active:bg-primary/80',
                  isChecking && 'opacity-50'
                )}
              >
                {checkedMembers.has(bestMatch.member.id) ? '출석 ✓' : isChecking ? '처리중...' : '출석 체크'}
              </button>
            )}
          </div>

          {/* Multiple matches */}
          {matches.length > 1 && (
            <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
              {matches
                .filter((m) => m !== bestMatch)
                .map((match) => (
                  <button
                    key={match.member.id}
                    onClick={() => {
                      if (activeEvents.length > 0) {
                        handleAttendanceCheck(match.member.id)
                      } else {
                        stopCamera()
                        router.push(`/members/${match.member.id}`)
                      }
                    }}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg flex-shrink-0',
                      checkedMembers.has(match.member.id)
                        ? 'bg-green-50 ring-1 ring-green-300'
                        : 'bg-gray-50 active:bg-gray-100'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {match.member.photo_url ? (
                        <img
                          src={match.member.photo_url}
                          alt={match.member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-muted">
                          {getInitials(match.member.name)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium">{match.member.name}</span>
                    {checkedMembers.has(match.member.id) && (
                      <span className="text-green-600 text-xs font-bold">✓</span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
