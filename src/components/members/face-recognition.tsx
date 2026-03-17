'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFaceRecognition, type MemberWithPhoto, type MatchResult } from '@/hooks/use-face-recognition'
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
  initialCheckedMemberIds?: string[]
}

interface ImgTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export function FaceRecognition({ members, activeEvents = [], initialCheckedMemberIds = [] }: FaceRecognitionProps) {
  const router = useRouter()
  const {
    status,
    progress,
    skippedMembers,
    autoMatches,
    manualMatches,
    resultImageUrl,
    videoRef,
    startCamera,
    stopCamera,
    flipCamera,
    captureAndRecognize,
    retake,
    errorMessage,
  } = useFaceRecognition(members)

  // 모델 준비 완료 시 카메라 자동 시작
  useEffect(() => {
    if (status === 'ready') startCamera('environment')
  }, [status, startCamera])

  // 미등록 단원 알림
  useEffect(() => {
    if (status === 'ready' && skippedMembers.length > 0) {
      toast(
        `${members.length}명 중 ${members.length - skippedMembers.length}명 등록 완료 (${skippedMembers.length}명 얼굴 미감지)`,
        'info'
      )
    }
  }, [status, skippedMembers, members.length])

  // 언마운트 시 카메라 종료
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const [selectedEventId, setSelectedEventId] = useState<string>(activeEvents[0]?.id ?? '')
  const [checkedMembers, setCheckedMembers] = useState<Set<string>>(new Set(initialCheckedMemberIds))
  const [isChecking, setIsChecking] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 })

  // 결과 표시 시 자동 인식 멤버 기본 선택
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (status === 'results') {
      setSelectedMatchIds(new Set(autoMatches.map((m) => m.member.id)))
      setImgTransform(null)
    }
  }, [status, autoMatches])

  const toggleMatch = (memberId: string) => {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev)
      next.has(memberId) ? next.delete(memberId) : next.add(memberId)
      return next
    })
  }

  // 결과 이미지 좌표 변환
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const [imgTransform, setImgTransform] = useState<ImgTransform | null>(null)

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const container = imageContainerRef.current
    if (!container) return
    const cW = container.clientWidth
    const cH = container.clientHeight
    const scale = Math.min(cW / img.naturalWidth, cH / img.naturalHeight)
    setImgTransform({
      scale,
      offsetX: (cW - img.naturalWidth * scale) / 2,
      offsetY: (cH - img.naturalHeight * scale) / 2,
    })
  }, [])

  // 얼굴 박스 클릭 팝업
  const [selectedMatch, setSelectedMatch] = useState<{ match: MatchResult; isAuto: boolean } | null>(null)

  const allMatchesWithType = [
    ...autoMatches.map((m) => ({ match: m, isAuto: true })),
    ...manualMatches.map((m) => ({ match: m, isAuto: false })),
  ]

  // 팝업에서 개별 출석 처리
  const handlePopupCheck = async (memberId: string) => {
    if (!selectedEventId || checkedMembers.has(memberId)) return
    setIsChecking(true)
    const result = await upsertAttendance(selectedEventId, [
      { member_id: memberId, status: '출석', checked_at: new Date().toISOString() },
    ])
    setIsChecking(false)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      setCheckedMembers((prev) => new Set(prev).add(memberId))
      setSelectedMatchIds((prev) => new Set(prev).add(memberId))
      toast('출석 처리되었습니다 ✓')
      setSelectedMatch(null)
    }
  }

  // 일괄 출석 처리
  const allMatches = [...autoMatches, ...manualMatches]
  const uncheckedSelectedCount = [...selectedMatchIds].filter((id) => !checkedMembers.has(id)).length

  const handleBatchCheck = async () => {
    if (!selectedEventId) { toast('진행중인 출석부가 없습니다', 'error'); return }
    const toCheck = [...selectedMatchIds].filter((id) => !checkedMembers.has(id))
    if (toCheck.length === 0) { toast('처리할 단원이 없습니다', 'info'); return }
    setIsChecking(true)
    const result = await upsertAttendance(
      selectedEventId,
      toCheck.map((id) => ({ member_id: id, status: '출석', checked_at: new Date().toISOString() }))
    )
    setIsChecking(false)
    if (result.error) {
      toast(result.error, 'error')
    } else {
      setCheckedMembers((prev) => { const next = new Set(prev); toCheck.forEach((id) => next.add(id)); return next })
      toast(`${toCheck.length}명 출석 처리 완료 ✓`)
    }
  }

  // descriptor 없는 멤버 동기화
  const membersWithoutDescriptor = members.filter((m) => !m.face_descriptor || m.face_descriptor.length !== 128)
  const handleSyncDescriptors = async () => {
    if (membersWithoutDescriptor.length === 0) { toast('모든 단원의 특징값이 이미 저장되어 있습니다', 'info'); return }
    setIsSyncing(true)
    setSyncProgress({ current: 0, total: membersWithoutDescriptor.length })
    let successCount = 0
    for (let i = 0; i < membersWithoutDescriptor.length; i++) {
      const member = membersWithoutDescriptor[i]
      const desc = await extractDescriptorFromUrl(member.photo_url)
      if (desc.success) {
        const result = await updateFaceDescriptor(member.id, desc.descriptor)
        if (result.success) successCount++
      }
      setSyncProgress({ current: i + 1, total: membersWithoutDescriptor.length })
    }
    setIsSyncing(false)
    toast(`${successCount}명의 특징값 저장 완료`)
  }

  return (
    // fixed inset-0: 부모 레이아웃(pb-20, Header) 완전히 무시하고 뷰포트 전체 사용
    <div className="fixed inset-0 z-50 flex flex-col bg-black">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm">
        <button
          onClick={() => { stopCamera(); router.back() }}
          className="text-white"
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
          {isSyncing && <span className="text-xs text-yellow-300">{syncProgress.current}/{syncProgress.total}</span>}
          <button onClick={flipCamera} className="text-white" disabled={status !== 'viewfinder'}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
              <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
              <path d="m14 9 3-3 3 3" /><path d="m10 15-3 3-3-3" />
            </svg>
          </button>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">

        {/* 모델 로딩 */}
        {status === 'loading-models' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <LoadingSpinner size="lg" className="text-white" />
            <p className="text-white text-sm">얼굴 인식 모델 로딩 중...</p>
          </div>
        )}

        {/* Descriptor 빌드 */}
        {status === 'building-descriptors' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <p className="text-white text-sm">단원 사진 분석 중... ({progress.current}/{progress.total})</p>
            <div className="w-full max-w-xs bg-white/20 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* 에러 */}
        {status === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-white text-sm text-center">{errorMessage}</p>
            <Button size="sm" onClick={() => window.location.reload()}>다시 시도</Button>
          </div>
        )}

        {/* 단원 없음 */}
        {status === 'ready' && members.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
            <p className="text-white text-sm text-center">사진이 등록된 단원이 없습니다.<br />단원 등록 시 사진을 추가해주세요.</p>
            <Button size="sm" onClick={() => router.push('/members')}>단원 관리로 이동</Button>
          </div>
        )}

        {/* ── 뷰파인더 ── */}
        {/* video는 항상 DOM에 존재해야 videoRef가 startCamera() 시점에 유효함 */}
        <div className={cn(
          'flex-1 flex flex-col min-h-0',
          (status !== 'viewfinder' && status !== 'capturing') && 'hidden'
        )}>
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {status === 'capturing' && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="lg" className="text-white" />
                <p className="text-white text-sm font-medium">얼굴 인식 중...</p>
              </div>
            )}
            {status === 'viewfinder' && (
              <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                <div className="bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full">
                  단원들이 모두 보이도록 맞춰주세요
                </div>
              </div>
            )}
          </div>
          {/* 촬영 버튼 - video 외부 고정 */}
          <div className="flex-shrink-0 h-24 flex items-center justify-center bg-black">
            {status === 'viewfinder' && (
              <button
                onClick={captureAndRecognize}
                className="w-20 h-20 rounded-full bg-white shadow-2xl active:scale-95 transition-transform flex items-center justify-center"
              >
                <div className="w-16 h-16 rounded-full border-2 border-gray-300" />
              </button>
            )}
          </div>
        </div>

        {/* ── 결과 화면 ── */}
        {status === 'results' && resultImageUrl && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">

            {/* 촬영 이미지 + 얼굴 박스 오버레이 */}
            <div
              ref={imageContainerRef}
              className="relative bg-black flex-shrink-0"
              style={{ height: '42dvh' }}
            >
              <img
                src={resultImageUrl}
                alt="촬영된 사진"
                className="w-full h-full object-contain"
                onLoad={handleImageLoad}
              />

              {/* 클릭 가능 얼굴 박스 오버레이 */}
              {imgTransform && allMatchesWithType.map(({ match, isAuto }) => {
                const { x, y, width, height } = match.box
                const left = imgTransform.offsetX + x * imgTransform.scale
                const top = imgTransform.offsetY + y * imgTransform.scale
                const w = width * imgTransform.scale
                const h = height * imgTransform.scale
                const labelAbove = top > 24
                return (
                  <button
                    key={match.member.id}
                    style={{ position: 'absolute', left, top, width: w, height: h }}
                    onClick={() => setSelectedMatch({ match, isAuto })}
                    className={cn(
                      'border-2 rounded-sm hover:opacity-80 transition-opacity',
                      isAuto ? 'border-green-400' : 'border-amber-400'
                    )}
                  >
                    <span className={cn(
                      'absolute left-0 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap leading-tight',
                      isAuto ? 'bg-green-500/90' : 'bg-amber-500/90',
                      labelAbove ? '-top-5' : 'top-0.5'
                    )}>
                      {match.member.name}
                    </span>
                  </button>
                )
              })}

              {/* 다시 찍기 */}
              <button
                onClick={retake}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-sm px-3 py-2 rounded-xl"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                다시 찍기
              </button>
            </div>

            {/* 인식 결과 리스트 */}
            <div className="flex-1 bg-white overflow-y-auto pb-safe min-h-0">
              {activeEvents.length > 1 && (
                <div className="px-4 pt-3 pb-1">
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-gray-50"
                  >
                    {activeEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.event_name} ({ev.event_date})</option>
                    ))}
                  </select>
                </div>
              )}

              {allMatches.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
                    <line x1="18" y1="6" x2="22" y2="10" /><line x1="22" y1="6" x2="18" y2="10" />
                  </svg>
                  <p className="text-sm">인식된 단원이 없습니다</p>
                  <button onClick={retake} className="text-sm text-primary font-medium">다시 찍기</button>
                </div>
              )}

              {autoMatches.length > 0 && (
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">자동 인식 · {autoMatches.length}명</p>
                  <div className="flex flex-col gap-2">
                    {autoMatches.map((match) => (
                      <MatchCard
                        key={match.member.id}
                        match={match}
                        isAuto
                        isSelected={selectedMatchIds.has(match.member.id)}
                        isAlreadyChecked={checkedMembers.has(match.member.id)}
                        onToggle={() => toggleMatch(match.member.id)}
                        onTapPhoto={() => setSelectedMatch({ match, isAuto: true })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {manualMatches.length > 0 && (
                <div className="px-4 pt-3 pb-2">
                  <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-2">확인 필요 · {manualMatches.length}명</p>
                  <div className="flex flex-col gap-2">
                    {manualMatches.map((match) => (
                      <MatchCard
                        key={match.member.id}
                        match={match}
                        isAuto={false}
                        isSelected={selectedMatchIds.has(match.member.id)}
                        isAlreadyChecked={checkedMembers.has(match.member.id)}
                        onToggle={() => toggleMatch(match.member.id)}
                        onTapPhoto={() => setSelectedMatch({ match, isAuto: false })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {allMatches.length > 0 && <div className="h-24" />}
            </div>

            {/* 일괄 출석 처리 버튼 */}
            {allMatches.length > 0 && activeEvents.length > 0 && (
              <div
                className="flex-shrink-0 px-4 pt-3 bg-white/95 backdrop-blur-sm border-t border-gray-100"
                style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
              >
                <button
                  onClick={handleBatchCheck}
                  disabled={isChecking || uncheckedSelectedCount === 0}
                  className={cn(
                    'w-full py-3.5 rounded-xl font-bold text-base transition-colors',
                    uncheckedSelectedCount > 0 ? 'bg-primary text-white active:bg-primary/80' : 'bg-gray-100 text-gray-400'
                  )}
                >
                  {isChecking ? '처리 중...' : uncheckedSelectedCount > 0 ? `${uncheckedSelectedCount}명 출석 처리` : '모두 처리 완료'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 얼굴 클릭 팝업 (바텀시트) ── */}
      {selectedMatch && (
        <div
          className="absolute inset-0 z-10 bg-black/50 flex items-end"
          onClick={() => setSelectedMatch(null)}
        >
          <div
            className="bg-white w-full rounded-t-2xl px-5 pt-5"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 드래그 핸들 */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* 단원 정보 */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                {selectedMatch.match.member.photo_url ? (
                  <img
                    src={selectedMatch.match.member.photo_url}
                    alt={selectedMatch.match.member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-semibold text-muted">
                    {getInitials(selectedMatch.match.member.name)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {selectedMatch.match.member.group_number && (
                    <span className="text-base font-bold text-muted">
                      {selectedMatch.match.member.group_number}조
                    </span>
                  )}
                  <span className="text-xl font-bold">{selectedMatch.match.member.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <Badge>{selectedMatch.match.member.department}</Badge>
                  <Badge>{selectedMatch.match.member.part}</Badge>
                </div>
                <p className={cn(
                  'text-xs font-medium mt-1.5',
                  selectedMatch.isAuto ? 'text-green-600' : 'text-amber-500'
                )}>
                  {selectedMatch.isAuto ? '자동 인식 ✓' : '확인 필요'}
                </p>
              </div>
            </div>

            {/* 출석 처리 버튼 */}
            {activeEvents.length > 0 && (
              <button
                onClick={() => handlePopupCheck(selectedMatch.match.member.id)}
                disabled={isChecking || checkedMembers.has(selectedMatch.match.member.id)}
                className={cn(
                  'w-full py-3.5 rounded-xl font-bold text-base transition-colors',
                  checkedMembers.has(selectedMatch.match.member.id)
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : isChecking
                      ? 'bg-primary/60 text-white'
                      : 'bg-primary text-white active:bg-primary/80'
                )}
              >
                {checkedMembers.has(selectedMatch.match.member.id)
                  ? '출석 완료 ✓'
                  : isChecking ? '처리 중...' : '출석 처리'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 멤버 카드 ──
interface MatchCardProps {
  match: MatchResult
  isAuto: boolean
  isSelected: boolean
  isAlreadyChecked: boolean
  onToggle: () => void
  onTapPhoto: () => void
}

function MatchCard({ match, isAuto, isSelected, isAlreadyChecked, onToggle, onTapPhoto }: MatchCardProps) {
  const { member } = match
  return (
    <div className={cn(
      'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border-l-4 bg-gray-50',
      isAuto ? 'border-green-400' : 'border-amber-400',
      isAlreadyChecked && 'opacity-60'
    )}>
      {/* 아바타 - 클릭 시 팝업 */}
      <button onClick={onTapPhoto} className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
        {member.photo_url
          ? <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
          : <span className="text-sm font-bold text-muted">{getInitials(member.name)}</span>
        }
      </button>

      {/* 이름 + 정보 */}
      <button onClick={onTapPhoto} className="flex-1 min-w-0 text-left">
        <div className="flex items-baseline gap-1.5">
          {member.group_number && <span className="text-sm font-bold text-muted">{member.group_number}조</span>}
          <span className="font-bold text-base truncate">{member.name}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Badge>{member.department}</Badge>
          <Badge>{member.part}</Badge>
        </div>
      </button>

      {/* 체크박스 토글 */}
      <button
        onClick={onToggle}
        disabled={isAlreadyChecked}
        className={cn(
          'w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-colors',
          isAlreadyChecked
            ? 'bg-green-500 border-green-500'
            : isSelected
              ? (isAuto ? 'bg-green-500 border-transparent' : 'bg-amber-400 border-transparent')
              : 'border-gray-300 bg-white'
        )}
      >
        {(isSelected || isAlreadyChecked) && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  )
}
