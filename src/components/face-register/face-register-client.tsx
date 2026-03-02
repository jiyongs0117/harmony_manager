'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import * as faceapi from 'face-api.js'
import { cn } from '@/lib/utils'
import { searchMembersByName, updateFaceDescriptors } from '@/actions/public-face-register'

// ─── 타입 ────────────────────────────────────────────────────────────
type PageStep = 'search' | 'found' | 'camera-init' | 'capturing' | 'processing' | 'done'
type CaptureAngle = 'front' | 'left' | 'right'

interface FoundMember {
  id: string
  name: string
  group_number: string | null
  part: string
  department: string
}

// ─── 상수 ────────────────────────────────────────────────────────────
const MODEL_URL = '/models'
const DETECTION_INTERVAL_MS = 500
const CAPTURE_ANGLES: CaptureAngle[] = ['front', 'left', 'right']

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

// ─── 컴포넌트 ─────────────────────────────────────────────────────────
export function FaceRegisterClient() {
  // 검색 상태
  const [step, setStep] = useState<PageStep>('search')
  const [nameInput, setNameInput] = useState('')
  const [searchResults, setSearchResults] = useState<FoundMember[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [foundMember, setFoundMember] = useState<FoundMember | null>(null)

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
  const currentAngleIndexRef = useRef(0)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    currentAngleIndexRef.current = currentAngleIndex
  }, [currentAngleIndex])

  // ─── 카메라 정리 ────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    isActiveRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    clearCountdownTimer()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

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
  function selectMember(member: FoundMember) {
    setFoundMember(member)
    setSearchResults([])
    setStep('found')
  }

  // ─── 카메라 & 모델 초기화 ────────────────────────────────────────────
  async function startFaceCapture() {
    setStep('camera-init')
    setCameraError(null)

    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })

      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      streamRef.current = stream

      videoRef.current.onloadedmetadata = () => {
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
      setCameraError('카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라를 허용해주세요.')
      setStep('found')
    }
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

    const result = await updateFaceDescriptors(foundMember.id, descriptors)

    if (result.error) {
      setSaveError(result.error)
      setStep('found')
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
    setCurrentAngleIndex(0)
    setCapturedCount(0)
    setFaceDetected(false)
    setCountdown(null)
    capturedDescriptorsRef.current = []
    captureLockedRef.current = false
  }

  const currentAngle = CAPTURE_ANGLES[currentAngleIndex]

  // ─── 렌더 ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[100dvh] bg-black overflow-hidden">

      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        {(step === 'found' || step === 'capturing') && (
          <button
            onClick={step === 'capturing'
              ? () => { stopCamera(); setStep('found') }
              : () => { setStep('search'); setNameInput('') }}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="뒤로"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-white font-semibold text-lg flex-1">얼굴 등록</h1>

        {step === 'capturing' && (
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
      {(step === 'search' || step === 'found' || step === 'camera-init') && (
        <div className="flex-1 flex flex-col px-6 py-8 gap-5 bg-zinc-950 overflow-y-auto">

          {step === 'search' && (
            <>
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

              {/* 이름 검색 입력 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-white/70 text-sm font-medium">이름</label>
                <div className="relative">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="이름 2글자 이상 입력"
                    className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3.5 text-base placeholder-white/30 border border-zinc-700 focus:outline-none focus:border-white/40 pr-10"
                    autoComplete="off"
                  />
                  {/* 로딩 / 클리어 */}
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

                {/* 검색 결과 리스트 */}
                {nameInput.trim().length >= 2 && !isSearching && (
                  <div className="flex flex-col gap-1 mt-1">
                    {searchError && (
                      <p className="text-red-400 text-sm px-1">{searchError}</p>
                    )}
                    {!searchError && searchResults.length === 0 && (
                      <p className="text-white/40 text-sm text-center py-4">
                        검색 결과가 없습니다
                      </p>
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
            </>
          )}

          {/* ── 단원 확인 단계 ── */}
          {(step === 'found' || step === 'camera-init') && foundMember && (
            <>
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

              <div className="bg-zinc-900 rounded-xl px-4 py-4 flex flex-col gap-2">
                <p className="text-white/60 text-sm font-medium">촬영 안내</p>
                {CAPTURE_ANGLES.map((angle, i) => (
                  <div key={angle} className="flex items-center gap-2 text-white/50 text-sm">
                    <span className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs flex-shrink-0">{i + 1}</span>
                    {ANGLE_GUIDES[angle]}
                  </div>
                ))}
                <p className="text-white/30 text-xs mt-1">얼굴이 감지되면 3초 후 자동으로 촬영됩니다</p>
              </div>

              <button
                onClick={startFaceCapture}
                disabled={step === 'camera-init'}
                className="w-full bg-white text-black font-semibold py-4 rounded-xl text-base disabled:opacity-50 active:scale-95 transition-transform"
              >
                {step === 'camera-init' ? '카메라 준비 중...' : '얼굴 등록 시작'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 캡처 단계 ── */}
      {step === 'capturing' && (
        <>
          <div className="relative flex-1 overflow-hidden bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]" />

            {/* 타원 가이드 */}
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
          </div>

          {/* 하단 안내 */}
          <div className="bg-black px-6 py-5">
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
        </>
      )}

      {/* ── 저장 중 ── */}
      {step === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950">
          <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-white font-semibold text-lg">얼굴 정보 저장 중...</p>
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
            <p className="text-white/50 text-sm mt-2">{foundMember?.name}님의 얼굴이 등록되었습니다</p>
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
