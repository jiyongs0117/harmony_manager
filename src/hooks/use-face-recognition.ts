'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'

export interface MemberWithPhoto {
  id: string
  name: string
  department: string
  part: string
  group_number: string | null
  photo_url: string
  face_descriptor?: number[] | null
  face_descriptors?: number[][] | null
}

export interface MatchResult {
  member: MemberWithPhoto
  distance: number
  box: { x: number; y: number; width: number; height: number }
}

export type RecognitionStatus =
  | 'idle'
  | 'loading-models'
  | 'building-descriptors'
  | 'ready'
  | 'viewfinder'
  | 'error'

const MODEL_URL = '/models'
const MATCH_THRESHOLD = 0.38       // 이 이상이면 무시
const AUTO_CHECK_THRESHOLD = 0.30  // 이 이하면 자동 출석 (녹색)
const DETECT_MIN_CONFIDENCE = 0.4  // SSD 디텍션 최소 신뢰도
const DETECTION_INTERVAL_MS = 80   // worker 처리 중에는 자동 throttle되므로 짧게

// worker → main 메시지 타입
type WorkerOutgoing =
  | { type: 'init-done' }
  | { type: 'init-error'; error: string }
  | { type: 'matcher-set' }
  | { type: 'detect-result'; frameId: number; matches: { memberId: string; distance: number; box: { x: number; y: number; width: number; height: number } }[] }
  | { type: 'detect-error'; frameId: number; error: string }

export function useFaceRecognition(members: MemberWithPhoto[]) {
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [skippedMembers, setSkippedMembers] = useState<MemberWithPhoto[]>([])
  const [accumulatedMatches, setAccumulatedMatches] = useState<Map<string, MatchResult>>(new Map())
  const [liveDetections, setLiveDetections] = useState<MatchResult[]>([])
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const membersMapRef = useRef<Map<string, MemberWithPhoto>>(new Map())

  // worker 관련
  const workerRef = useRef<Worker | null>(null)
  const matcherReadyRef = useRef(false)
  const frameIdRef = useRef(0)
  const inflightFrameRef = useRef<number | null>(null)
  const initResolverRef = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null)
  const matcherResolverRef = useRef<{ resolve: () => void } | null>(null)

  // 실시간 감지 루프 제어
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const liveActiveRef = useRef(false)

  // worker 응답 처리: 검출 결과를 누적 상태로 반영
  const handleDetectionResult = useCallback((frameId: number, rawMatches: { memberId: string; distance: number; box: { x: number; y: number; width: number; height: number } }[]) => {
    if (inflightFrameRef.current !== frameId) {
      // 오래된/취소된 결과 — 정상 frame은 처리 후 inflight를 null로
      inflightFrameRef.current = null
      return
    }
    inflightFrameRef.current = null

    if (!liveActiveRef.current) return

    const frameMatches: MatchResult[] = []
    for (const m of rawMatches) {
      const member = membersMapRef.current.get(m.memberId)
      if (!member) continue
      frameMatches.push({ member, distance: m.distance, box: m.box })
    }

    setLiveDetections(frameMatches)
    setAccumulatedMatches((prev) => {
      let changed = false
      const next = new Map(prev)
      for (const fm of frameMatches) {
        const existing = next.get(fm.member.id)
        if (!existing || fm.distance < existing.distance) {
          next.set(fm.member.id, fm)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  // worker 생성 + 모델 로드 + 매처 빌드
  useEffect(() => {
    let cancelled = false

    async function init() {
      setStatus('loading-models')
      setErrorMessage(null)

      try {
        const worker = new Worker(
          new URL('../lib/face-detection-worker.ts', import.meta.url),
          { type: 'module' }
        )
        workerRef.current = worker

        // 통합 메시지 핸들러
        worker.addEventListener('message', (e: MessageEvent<WorkerOutgoing>) => {
          const msg = e.data
          switch (msg.type) {
            case 'init-done':
              initResolverRef.current?.resolve()
              initResolverRef.current = null
              break
            case 'init-error':
              initResolverRef.current?.reject(new Error(msg.error))
              initResolverRef.current = null
              break
            case 'matcher-set':
              matcherResolverRef.current?.resolve()
              matcherResolverRef.current = null
              break
            case 'detect-result':
              handleDetectionResult(msg.frameId, msg.matches)
              break
            case 'detect-error':
              console.warn('[face-worker] detect error:', msg.error)
              if (inflightFrameRef.current === msg.frameId) inflightFrameRef.current = null
              break
          }
        })

        worker.addEventListener('error', (e) => {
          if (initResolverRef.current) {
            initResolverRef.current.reject(new Error(e.message || 'worker error'))
            initResolverRef.current = null
          }
        })

        // 모델 로드 (Worker fetch는 절대 URL이 필요하므로 origin 기준으로 절대화)
        const absoluteModelUrl = new URL(MODEL_URL, window.location.origin).href
        await new Promise<void>((resolve, reject) => {
          initResolverRef.current = { resolve, reject }
          worker.postMessage({ type: 'init', modelUrl: absoluteModelUrl })
        })

        if (cancelled) return

        // 매처 빌드
        setStatus('building-descriptors')
        setProgress({ current: 0, total: members.length })

        const labeled: { id: string; descriptors: number[][] }[] = []
        const skipped: MemberWithPhoto[] = []
        const memberMap = new Map<string, MemberWithPhoto>()

        for (let i = 0; i < members.length; i++) {
          if (cancelled) return
          const member = members[i]
          memberMap.set(member.id, member)

          let descs: number[][] = []
          if (
            member.face_descriptors &&
            member.face_descriptors.length > 0 &&
            member.face_descriptors.every((d) => d.length === 128)
          ) {
            descs = member.face_descriptors
          } else if (member.face_descriptor && member.face_descriptor.length === 128) {
            descs = [member.face_descriptor]
          }

          if (descs.length > 0) {
            labeled.push({ id: member.id, descriptors: descs })
          } else {
            skipped.push(member)
          }

          setProgress({ current: i + 1, total: members.length })
        }

        if (cancelled) return

        membersMapRef.current = memberMap
        setSkippedMembers(skipped)

        await new Promise<void>((resolve) => {
          matcherResolverRef.current = { resolve }
          worker.postMessage({ type: 'set-matcher', labeled, threshold: MATCH_THRESHOLD })
        })

        if (cancelled) return

        matcherReadyRef.current = labeled.length > 0
        setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setErrorMessage(
            `얼굴 인식 초기화에 실패했습니다. ${err instanceof Error ? err.message : ''}`
          )
        }
      }
    }

    if (members.length > 0) {
      init()
    } else {
      // sync setState in effect body는 lint 규칙에 걸리므로 microtask로 디퍼
      queueMicrotask(() => {
        if (!cancelled) setStatus('ready')
      })
    }

    return () => {
      cancelled = true
      const w = workerRef.current
      workerRef.current = null
      w?.terminate()
      initResolverRef.current = null
      matcherResolverRef.current = null
      matcherReadyRef.current = false
    }
  }, [members, handleDetectionResult])

  // 스트림만 종료
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // 실시간 감지 루프 종료
  const stopLiveDetection = useCallback(() => {
    liveActiveRef.current = false
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current)
      detectionTimeoutRef.current = null
    }
  }, [])

  // 실시간 감지 루프: 비디오 → ImageBitmap → worker.postMessage(transfer)
  const runDetectionLoop = useCallback(() => {
    const tick = async () => {
      if (!liveActiveRef.current) return
      const video = videoRef.current
      const worker = workerRef.current

      if (!video || video.readyState < 2 || !worker || !matcherReadyRef.current) {
        detectionTimeoutRef.current = setTimeout(tick, 300)
        return
      }
      // worker가 이전 프레임 처리 중이면 짧게 재시도
      if (inflightFrameRef.current !== null) {
        detectionTimeoutRef.current = setTimeout(tick, 60)
        return
      }

      try {
        const bitmap = await createImageBitmap(video)
        if (!liveActiveRef.current) {
          bitmap.close()
          return
        }
        const frameId = ++frameIdRef.current
        inflightFrameRef.current = frameId
        worker.postMessage(
          { type: 'detect', frame: bitmap, frameId, minConfidence: DETECT_MIN_CONFIDENCE },
          [bitmap] // zero-copy transfer
        )
      } catch {
        // bitmap 생성 실패 시 다음 틱으로 넘어감
      }

      if (liveActiveRef.current) {
        detectionTimeoutRef.current = setTimeout(tick, DETECTION_INTERVAL_MS)
      }
    }
    tick()
  }, [])

  const startCamera = useCallback(async (mode: 'user' | 'environment' = 'environment') => {
    setErrorMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setFacingMode(mode)
        videoRef.current.onloadedmetadata = () => {
          const v = videoRef.current
          if (!v) return
          v.play()
          setVideoSize({ width: v.videoWidth, height: v.videoHeight })
          setStatus('viewfinder')
          liveActiveRef.current = true
          runDetectionLoop()
        }
      }
    } catch {
      setErrorMessage('카메라 권한이 필요합니다. 브라우저 설정에서 카메라 접근을 허용해주세요.')
    }
  }, [runDetectionLoop])

  const stopCamera = useCallback(() => {
    stopLiveDetection()
    stopStream()
    setLiveDetections([])
    setAccumulatedMatches(new Map())
    setVideoSize(null)
    setStatus('ready')
  }, [stopStream, stopLiveDetection])

  const flipCamera = useCallback(async () => {
    stopLiveDetection()
    stopStream()
    setLiveDetections([])
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    await startCamera(newMode)
  }, [facingMode, stopStream, stopLiveDetection, startCamera])

  const clearMatches = useCallback(() => {
    setAccumulatedMatches(new Map())
  }, [])

  // 언마운트 정리
  useEffect(() => {
    return () => {
      stopLiveDetection()
      stopStream()
    }
  }, [stopStream, stopLiveDetection])

  // 누적 결과를 자동/수동으로 분류
  const { autoMatches, manualMatches } = useMemo(() => {
    const auto: MatchResult[] = []
    const manual: MatchResult[] = []
    for (const m of accumulatedMatches.values()) {
      if (m.distance <= AUTO_CHECK_THRESHOLD) auto.push(m)
      else manual.push(m)
    }
    auto.sort((a, b) => a.distance - b.distance)
    manual.sort((a, b) => a.distance - b.distance)
    return { autoMatches: auto, manualMatches: manual }
  }, [accumulatedMatches])

  return {
    status,
    progress,
    skippedMembers,
    autoMatches,
    manualMatches,
    liveDetections,
    videoSize,
    videoRef,
    startCamera,
    stopCamera,
    flipCamera,
    clearMatches,
    errorMessage,
    facingMode,
  }
}
