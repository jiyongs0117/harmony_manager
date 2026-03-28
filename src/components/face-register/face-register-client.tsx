'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import * as faceapi from 'face-api.js'
import { cn } from '@/lib/utils'
import {
  searchMembersByName,
  updateFaceDescriptors,
  updateMemberInfo,
  getMemberInfo,
  type MemberInfoInput,
} from '@/actions/public-face-register'

// ─── 타입 ────────────────────────────────────────────────────────────
type PageStep = 'search' | 'found' | 'info' | 'camera-init' | 'capturing' | 'processing' | 'done'
type CaptureAngle = 'front' | 'left' | 'right'

interface FoundMember {
  id: string
  name: string
  group_number: string | null
  part: string
  department: string
}

interface MemberInfoForm {
  church_position: string
  date_of_birth: string
  district: string
  area: string
  church_registration_year: string
  choir_join_year: string
  address: string
  prayer_request: string
}

const EMPTY_INFO: MemberInfoForm = {
  church_position: '',
  date_of_birth: '',
  district: '',
  area: '',
  church_registration_year: '',
  choir_join_year: '',
  address: '',
  prayer_request: '',
}

// ─── 상수 ────────────────────────────────────────────────────────────
const MODEL_URL = '/models'
const DETECTION_INTERVAL_MS = 500
const CAPTURE_ANGLES: CaptureAngle[] = ['front']
const CHURCH_POSITIONS = ['집사', '안수집사', '장로', '평신도']

const ANGLE_LABELS: Record<CaptureAngle, string> = {
  front: '정면',
  left: '좌측',
  right: '우측',
}
const ANGLE_GUIDES: Record<CaptureAngle, string> = {
  front: '카메라를 정면으로 바라봐 주세요',
  left: '천천히 왼쪽으로 45° 돌려주세요',
  right: '천천히 오른쪽으로 45° 돌려주세요',
}

// ─── 공통 인풋 스타일 ─────────────────────────────────────────────────
const inputCls = 'w-full bg-zinc-800 text-white rounded-xl px-4 py-3.5 text-base placeholder-white/30 border border-zinc-700 focus:outline-none focus:border-white/40'
const labelCls = 'text-white/60 text-xs font-medium'

// ─── 컴포넌트 ─────────────────────────────────────────────────────────
export function FaceRegisterClient() {
  // 검색 상태
  const [step, setStep] = useState<PageStep>('search')
  const [nameInput, setNameInput] = useState('')
  const [searchResults, setSearchResults] = useState<FoundMember[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [foundMember, setFoundMember] = useState<FoundMember | null>(null)

  // 개인 정보 폼
  const [memberInfo, setMemberInfo] = useState<MemberInfoForm>(EMPTY_INFO)
  const updateInfo = (key: keyof MemberInfoForm, value: string) =>
    setMemberInfo((prev) => ({ ...prev, [key]: value }))

  // 동의 상태
  const [privacyConsent, setPrivacyConsent] = useState(false)

  // 캡처 상태
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0)
  const [capturedCount, setCapturedCount] = useState(0)
  const [faceDetected, setFaceDetected] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const isActiveRef = useRef(false)
  const lastDetectionRef = useRef<number>(0)
  const captureLockedRef = useRef(false)
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const capturedDescriptorsRef = useRef<number[][]>([])
  const capturedFrontPhotoRef = useRef<string | null>(null)
  const currentAngleIndexRef = useRef(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const privacyConsentRef = useRef(false)

  useEffect(() => {
    currentAngleIndexRef.current = currentAngleIndex
  }, [currentAngleIndex])

  useEffect(() => {
    privacyConsentRef.current = privacyConsent
  }, [privacyConsent])

  // ─── 카메라 정리 ────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    isActiveRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ─── 카메라 초기화 useEffect ──────────────────────────────────────────
  useEffect(() => {
    if (step !== 'camera-init') return

    let cancelled = false

    ;(async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])

        if (cancelled) return

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        if (!videoRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          setCameraError('카메라 초기화 오류가 발생했습니다. 다시 시도해주세요.')
          setStep('info')
          return
        }

        videoRef.current.srcObject = stream
        streamRef.current = stream

        videoRef.current.onloadedmetadata = () => {
          if (cancelled) return
          videoRef.current?.play()
          setStep('capturing')
          isActiveRef.current = true
          capturedDescriptorsRef.current = []
          setCapturedCount(0)
          setCurrentAngleIndex(0)
          currentAngleIndexRef.current = 0
          captureLockedRef.current = false
          lastDetectionRef.current = 0
          detectionLoop()
        }
      } catch {
        if (!cancelled) {
          setCameraError('카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라를 허용해주세요.')
          setStep('info')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 이름 입력 디바운스 검색 ──────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    setSearchError(null)

    if (nameInput.trim().length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      const result = await searchMembersByName(nameInput)
      setIsSearching(false)
      if (result.error) {
        setSearchError(result.error)
        setSearchResults([])
      } else {
        setSearchResults(result.members ?? [])
      }
    }, 300)
  }, [nameInput])

  // ─── 단원 선택 ─────────────────────────────────────────────────────
  async function selectMember(member: FoundMember) {
    setFoundMember(member)
    setSearchResults([])
    setPrivacyConsent(false)
    setStep('found')

    // 기존 DB 데이터 조회 후 폼 초기값 설정
    const { data } = await getMemberInfo(member.id)
    if (data) {
      setMemberInfo({
        church_position: data.church_position ?? '',
        date_of_birth: data.date_of_birth ?? '',
        district: data.district ?? '',
        area: data.area ?? '',
        church_registration_year: data.church_registration_year ?? '',
        choir_join_year: data.choir_join_year ?? '',
        address: data.address ?? '',
        prayer_request: data.prayer_request ?? '',
      })
    }
  }

  // ─── 저장 및 얼굴등록 버튼 핸들러 ──────────────────────────────────────
  const [isSavingInfo, setIsSavingInfo] = useState(false)

  async function handleStartFaceCapture() {
    if (!foundMember) return
    setCameraError(null)
    setSaveError(null)
    setIsSavingInfo(true)

    const info: MemberInfoInput = {
      church_position: memberInfo.church_position || null,
      date_of_birth: memberInfo.date_of_birth || null,
      district: memberInfo.district || null,
      area: memberInfo.area || null,
      church_registration_year: memberInfo.church_registration_year || null,
      choir_join_year: memberInfo.choir_join_year || null,
      address: memberInfo.address || null,
      prayer_request: memberInfo.prayer_request.trim() || null,
    }

    const result = await updateMemberInfo(foundMember.id, info)
    setIsSavingInfo(false)

    if (result.error) {
      setSaveError(result.error)
      return
    }

    setStep('camera-init')
  }

  // ─── 감지 루프 ─────────────────────────────────────────────────────
  function detectionLoop() {
    if (!isActiveRef.current) return

    animFrameRef.current = requestAnimationFrame(async () => {
      const now = Date.now()
      if (now - lastDetectionRef.current < DETECTION_INTERVAL_MS) {
        detectionLoop()
        return
      }
      lastDetectionRef.current = now

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        detectionLoop()
        return
      }

      const displaySize = { width: video.videoWidth, height: video.videoHeight }
      faceapi.matchDimensions(canvas, displaySize)

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor()

        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (detection) {
          setFaceDetected(true)
          drawFaceEllipse(ctx, faceapi.resizeResults(detection, displaySize))
          if (!captureLockedRef.current) {
            startCountdown(Array.from(detection.descriptor))
          }
        } else {
          setFaceDetected(false)
          if (!captureLockedRef.current) {
            clearCountdownTimer()
            setCountdown(null)
          }
        }
      } catch {
        // 감지 오류 무시
      }

      detectionLoop()
    })
  }

  function drawFaceEllipse(
    ctx: CanvasRenderingContext2D | null,
    detection: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>>,
  ) {
    if (!ctx) return
    const box = detection.detection.box
    ctx.beginPath()
    ctx.ellipse(
      box.x + box.width / 2,
      box.y + box.height / 2,
      box.width / 2 + 8,
      box.height / 2 + 12,
      0, 0, Math.PI * 2,
    )
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // ─── 카운트다운 ────────────────────────────────────────────────────
  function clearCountdownTimer() {
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }

  function startCountdown(descriptor: number[]) {
    if (captureLockedRef.current) return
    captureLockedRef.current = true

    let count = 3
    setCountdown(count)

    function tick() {
      count--
      if (count > 0) {
        setCountdown(count)
        countdownTimerRef.current = setTimeout(tick, 1000)
      } else {
        setCountdown(null)
        captureAngle(descriptor)
      }
    }
    countdownTimerRef.current = setTimeout(tick, 1000)
  }

  function captureAngle(descriptor: number[]) {
    // 정면(첫 번째) 촬영 시 video 프레임을 사진으로 캡처
    if (currentAngleIndexRef.current === 0) {
      const video = videoRef.current
      if (video) {
        const photoCanvas = document.createElement('canvas')
        photoCanvas.width = video.videoWidth
        photoCanvas.height = video.videoHeight
        const ctx = photoCanvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          capturedFrontPhotoRef.current = photoCanvas.toDataURL('image/jpeg', 0.85)
        }
      }
    }

    const newDescriptors = [...capturedDescriptorsRef.current, descriptor]
    capturedDescriptorsRef.current = newDescriptors
    const captured = newDescriptors.length
    setCapturedCount(captured)

    if (captured >= CAPTURE_ANGLES.length) {
      stopCamera()
      saveDescriptors(newDescriptors)
    } else {
      const nextIndex = captured
      setCurrentAngleIndex(nextIndex)
      currentAngleIndexRef.current = nextIndex
      setFaceDetected(false)
      countdownTimerRef.current = setTimeout(() => {
        captureLockedRef.current = false
      }, 1200)
    }
  }

  async function saveDescriptors(descriptors: number[][]) {
    if (!foundMember) return
    setStep('processing')
    setSaveError(null)

    const faceResult = await updateFaceDescriptors(
      foundMember.id,
      descriptors,
      privacyConsentRef.current,
      capturedFrontPhotoRef.current ?? undefined,
    )

    if (faceResult.error) {
      setSaveError(faceResult.error)
      setStep('info')
      return
    }

    setStep('done')
  }

  function resetAll() {
    stopCamera()
    setStep('search')
    setNameInput('')
    setSearchResults([])
    setFoundMember(null)
    setSearchError(null)
    setSaveError(null)
    setPrivacyConsent(false)
    setMemberInfo(EMPTY_INFO)
    setCurrentAngleIndex(0)
    setCapturedCount(0)
    setFaceDetected(false)
    setCountdown(null)
    capturedDescriptorsRef.current = []
    capturedFrontPhotoRef.current = null
    captureLockedRef.current = false
  }

  const currentAngle = CAPTURE_ANGLES[currentAngleIndex]
  const isCameraActive = step === 'camera-init' || step === 'capturing'
  const isCapturing = step === 'capturing'

  // ─── 렌더 ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[100dvh] bg-black overflow-hidden">

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm z-10 flex-shrink-0">
        {(step === 'found' || step === 'info' || step === 'capturing') && (
          <button
            onClick={() => {
              if (step === 'capturing') { stopCamera(); setStep('info') }
              else if (step === 'info') setStep('found')
              else { setStep('search'); setNameInput('') }
            }}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="뒤로"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-white font-semibold text-lg flex-1">
          {step === 'info' ? '추가 정보 입력' : '얼굴 등록'}
        </h1>

        {isCapturing && (
          <div className="flex gap-2">
            {CAPTURE_ANGLES.map((_, i) => (
              <div key={i} className={cn(
                'w-2.5 h-2.5 rounded-full transition-all duration-300',
                i < capturedCount ? 'bg-green-400 scale-110' :
                i === currentAngleIndex ? 'bg-white' : 'bg-white/30',
              )} />
            ))}
          </div>
        )}
      </div>

      {/* ── 검색 단계 ── */}
      {step === 'search' && (
        <div className="flex-1 flex flex-col px-6 py-8 gap-5 bg-zinc-950 overflow-y-auto">
          <div className="text-center pt-2">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p className="text-white font-semibold text-xl">본인 확인</p>
            <p className="text-white/50 text-sm mt-1">이름을 입력하면 목록이 나타납니다</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-white/70 text-sm font-medium">이름</label>
            <div className="relative">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="이름 2글자 이상 입력"
                className={inputCls}
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : nameInput.length > 0 ? (
                  <button onClick={() => setNameInput('')} className="text-white/40 hover:text-white/70">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>

            {nameInput.trim().length >= 2 && !isSearching && (
              <div className="flex flex-col gap-1 mt-1">
                {searchError && <p className="text-red-400 text-sm px-1">{searchError}</p>}
                {!searchError && searchResults.length === 0 && (
                  <p className="text-white/40 text-sm text-center py-4">검색 결과가 없습니다</p>
                )}
                {searchResults.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => selectMember(member)}
                    className="flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl px-4 py-3.5 text-left transition-colors"
                  >
                    <div>
                      <p className="text-white font-semibold text-base">{member.name}</p>
                      <p className="text-white/50 text-sm mt-0.5">
                        {member.department} · {member.part}
                        {member.group_number && ` · ${member.group_number}`}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {nameInput.trim().length > 0 && nameInput.trim().length < 2 && (
              <p className="text-white/30 text-xs px-1">2글자 이상 입력해주세요</p>
            )}
          </div>
        </div>
      )}

      {/* ── 단원 확인 단계 ── */}
      {step === 'found' && foundMember && (
        <div className="flex-1 flex flex-col px-6 py-8 gap-5 bg-zinc-950 overflow-y-auto">
          <div className="text-center pt-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white/60 text-sm">
              {foundMember.department} · {foundMember.part}
              {foundMember.group_number && ` · ${foundMember.group_number}`}
            </p>
            <p className="text-white font-bold text-2xl mt-1">{foundMember.name}</p>
          </div>

          {cameraError && (
            <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-xl px-4 py-3">{cameraError}</p>
          )}
          {saveError && (
            <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-xl px-4 py-3">{saveError}</p>
          )}

          <div className="bg-zinc-900 rounded-xl px-4 py-4 flex flex-col gap-1.5">
            <p className="text-white/60 text-sm">다음 단계에서 추가 정보를 입력하고 얼굴을 등록합니다.</p>
            <ul className="text-white/40 text-xs flex flex-col gap-1 mt-1">
              <li>· 직분, 생년월일, 교구/구역, 등록연도</li>
              <li>· 주소, 개인 기도제목</li>
              <li>· 정면 얼굴 촬영</li>
            </ul>
          </div>

          <button
            onClick={() => setStep('info')}
            className="w-full bg-white text-black font-semibold py-4 rounded-xl text-base active:scale-95 transition-all"
          >
            다음 →
          </button>
        </div>
      )}

      {/* ── 추가 정보 입력 단계 ── */}
      {step === 'info' && foundMember && (
        <div className="flex-1 flex flex-col px-6 py-6 gap-5 bg-zinc-950 overflow-y-auto">

          {saveError && (
            <p className="text-red-400 text-sm text-center bg-red-950/30 rounded-xl px-4 py-3">{saveError}</p>
          )}

          {/* 직분 */}
          <div className="flex flex-col gap-2">
            <label className={labelCls}>직분</label>
            <div className="flex gap-2 flex-wrap">
              {CHURCH_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => updateInfo('church_position', memberInfo.church_position === pos ? '' : pos)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                    memberInfo.church_position === pos
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-white/60 border-zinc-700',
                  )}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* 생년월일 */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>생년월일</label>
            <input
              type="text"
              value={memberInfo.date_of_birth}
              onChange={(e) => updateInfo('date_of_birth', e.target.value)}
              placeholder="예: 1990-01-01"
              className={inputCls}
            />
          </div>

          {/* 교구 / 구역 */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className={labelCls}>교구</label>
              <input
                type="text"
                value={memberInfo.district}
                onChange={(e) => updateInfo('district', e.target.value)}
                placeholder="예: 1교구"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className={labelCls}>구역</label>
              <input
                type="text"
                value={memberInfo.area}
                onChange={(e) => updateInfo('area', e.target.value)}
                placeholder="예: 3구역"
                className={inputCls}
              />
            </div>
          </div>

          {/* 교회등록연도 / 찬양대 등록연도 */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className={labelCls}>교회 등록연도</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={memberInfo.church_registration_year}
                onChange={(e) => updateInfo('church_registration_year', e.target.value.replace(/\D/g, ''))}
                placeholder="예: 2010"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className={labelCls}>찬양대 등록연도</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={memberInfo.choir_join_year}
                onChange={(e) => updateInfo('choir_join_year', e.target.value.replace(/\D/g, ''))}
                placeholder="예: 2015"
                className={inputCls}
              />
            </div>
          </div>

          {/* 주소 */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>주소</label>
            <input
              type="text"
              value={memberInfo.address}
              onChange={(e) => updateInfo('address', e.target.value)}
              placeholder="도로명 주소 입력"
              className={inputCls}
            />
          </div>

          {/* 개인 기도제목 */}
          <div className="flex flex-col gap-2">
            <label className="text-white/60 text-sm font-medium">개인 기도제목</label>
            <textarea
              value={memberInfo.prayer_request}
              onChange={(e) => updateInfo('prayer_request', e.target.value)}
              placeholder="사업장, 질병, 자녀손, 생활 등 구체적으로"
              rows={5}
              className={inputCls + ' resize-none leading-relaxed'}
            />
          </div>

          {/* 개인정보 동의 */}
          <button
            type="button"
            onClick={() => setPrivacyConsent((v) => !v)}
            className={cn(
              'flex items-start gap-3 rounded-xl px-4 py-4 text-left border-2 transition-all',
              privacyConsent
                ? 'bg-blue-950/40 border-blue-500/50'
                : 'bg-zinc-900 border-zinc-700 active:border-zinc-500',
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors',
              privacyConsent ? 'bg-white border-white' : 'border-zinc-500',
            )}>
              {privacyConsent && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-white text-sm font-medium leading-snug">
                개인정보 수집 및 이용에 동의합니다{' '}
                <span className="text-red-400 text-xs font-normal">(필수)</span>
              </p>
              <p className="text-white/40 text-xs mt-1.5 leading-relaxed">
                · 수집항목: 얼굴 특징점, 개인정보<br />
                · 이용목적: 출석 자동 인식 및 단원 관리<br />
                · 보유기간: 단원 탈퇴 시까지
              </p>
            </div>
          </button>

          {/* 얼굴 등록 시작 */}
          <button
            onClick={handleStartFaceCapture}
            disabled={!privacyConsent || isSavingInfo}
            className="w-full bg-white text-black font-semibold py-4 rounded-xl text-base disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all mb-4"
          >
            {isSavingInfo ? '저장 중...' : '저장 및 얼굴등록'}
          </button>
        </div>
      )}

      {/* ── 카메라 패널 (camera-init + capturing 공유) ── */}
      {isCameraActive && (
        <>
          <div className="relative flex-1 overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
            />

            {step === 'camera-init' && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white animate-spin" />
                <p className="text-white/70 text-base">카메라 준비 중...</p>
              </div>
            )}

            {isCapturing && (
              <>
                <div className="absolute inset-0 flex items-center pointer-events-none" style={{ paddingBottom: '15%' }}>
                  <div className="w-full flex justify-center">
                    <div className={cn(
                      'rounded-full border-2 transition-all duration-300',
                      faceDetected && countdown === null ? 'border-green-400 border-dashed' :
                      countdown !== null ? 'border-green-500 border-solid animate-pulse' :
                      'border-white/40 border-dashed',
                    )} style={{ width: '62vw', height: '78vw', maxWidth: '230px', maxHeight: '290px' }} />
                  </div>
                </div>

                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: '15%' }}>
                    <span className="text-white text-8xl font-bold drop-shadow-2xl opacity-90">{countdown}</span>
                  </div>
                )}

                {capturedCount > 0 && capturedCount < CAPTURE_ANGLES.length && (
                  <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
                    <div className="bg-green-500 text-white text-sm font-medium px-4 py-1.5 rounded-full">
                      {ANGLE_LABELS[CAPTURE_ANGLES[capturedCount - 1]]} 완료 ✓
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {isCapturing && (
            <div className="bg-black px-6 py-5 flex-shrink-0">
              <div className="text-center mb-4">
                <p className="text-white font-semibold text-lg">
                  {ANGLE_LABELS[currentAngle]} 촬영 ({currentAngleIndex + 1} / {CAPTURE_ANGLES.length})
                </p>
                <p className="text-white/50 text-sm mt-1">
                  {faceDetected
                    ? countdown !== null ? `${countdown}초 후 자동 촬영됩니다` : '얼굴이 감지되었습니다'
                    : ANGLE_GUIDES[currentAngle]}
                </p>
              </div>

              <div className="flex justify-center gap-4">
                {CAPTURE_ANGLES.map((angle, i) => (
                  <div key={angle} className="flex flex-col items-center gap-1.5">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                      i < capturedCount ? 'bg-green-500 text-white scale-105' :
                      i === currentAngleIndex ? 'bg-white text-black scale-110' : 'bg-white/15 text-white/40',
                    )}>
                      {i < capturedCount ? '✓' : i + 1}
                    </div>
                    <span className={cn('text-xs transition-colors',
                      i < capturedCount ? 'text-green-400' :
                      i === currentAngleIndex ? 'text-white' : 'text-white/30',
                    )}>{ANGLE_LABELS[angle]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 저장 중 ── */}
      {step === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950">
          <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-white font-semibold text-lg">정보 저장 중...</p>
        </div>
      )}

      {/* ── 완료 ── */}
      {step === 'done' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-zinc-950 px-6">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/50 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-white font-bold text-2xl">등록 완료!</p>
            <p className="text-white/50 text-sm mt-2">{foundMember?.name}님의 정보가 저장되었습니다</p>
          </div>
          <div className="flex gap-4">
            {CAPTURE_ANGLES.map((angle) => (
              <div key={angle} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">✓</div>
                <span className="text-green-400 text-xs">{ANGLE_LABELS[angle]}</span>
              </div>
            ))}
          </div>
          <button onClick={resetAll} className="mt-2 w-full bg-white text-black font-semibold py-4 rounded-xl text-base active:scale-95 transition-transform">
            다른 단원 등록
          </button>
        </div>
      )}
    </div>
  )
}
