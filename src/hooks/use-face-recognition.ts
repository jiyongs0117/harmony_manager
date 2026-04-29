'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import * as faceapi from '@vladmandic/face-api'

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
  | 'viewfinder' // 카메라 활성화 + 실시간 감지 진행 중
  | 'error'

const MODEL_URL = '/models'
const MATCH_THRESHOLD = 0.38       // 이 이상이면 무시
const AUTO_CHECK_THRESHOLD = 0.28  // 이 이하면 자동 출석 (녹색)
const DETECTION_INTERVAL_MS = 250  // 프레임 간 대기 (실시간 감지 루프)

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
  const matcherRef = useRef<faceapi.FaceMatcher | null>(null)
  const membersMapRef = useRef<Map<string, MemberWithPhoto>>(new Map())

  // 실시간 감지 루프 제어
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDetectingRef = useRef(false)
  const liveActiveRef = useRef(false)

  // 모델 로드 및 descriptor 빌드
  useEffect(() => {
    let cancelled = false

    async function init() {
      setStatus('loading-models')
      setErrorMessage(null)

      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])

        if (cancelled) return

        setStatus('building-descriptors')
        const total = members.length
        setProgress({ current: 0, total })

        const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = []
        const skipped: MemberWithPhoto[] = []
        const memberMap = new Map<string, MemberWithPhoto>()

        for (let i = 0; i < members.length; i++) {
          if (cancelled) return

          const member = members[i]
          memberMap.set(member.id, member)

          const descriptorArrays: Float32Array[] = []

          if (
            member.face_descriptors &&
            member.face_descriptors.length > 0 &&
            member.face_descriptors.every((d) => d.length === 128)
          ) {
            descriptorArrays.push(
              ...member.face_descriptors.map((d) => new Float32Array(d))
            )
          } else if (member.face_descriptor && member.face_descriptor.length === 128) {
            descriptorArrays.push(new Float32Array(member.face_descriptor))
          }

          if (descriptorArrays.length > 0) {
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(member.id, descriptorArrays)
            )
          } else {
            skipped.push(member)
          }

          setProgress({ current: i + 1, total })
        }

        if (cancelled) return

        membersMapRef.current = memberMap
        setSkippedMembers(skipped)

        if (labeledDescriptors.length > 0) {
          matcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD)
        }

        setStatus('ready')
      } catch {
        if (!cancelled) {
          setStatus('error')
          setErrorMessage('모델 로딩에 실패했습니다. 네트워크 연결을 확인하고 다시 시도해주세요.')
        }
      }
    }

    if (members.length > 0) {
      init()
    } else {
      setStatus('ready')
    }

    return () => { cancelled = true }
  }, [members])

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

  // 실시간 감지 루프 시작
  const runDetectionLoop = useCallback(() => {
    const tick = async () => {
      if (!liveActiveRef.current) return
      const video = videoRef.current
      if (!video || video.readyState < 2 || !matcherRef.current) {
        detectionTimeoutRef.current = setTimeout(tick, 300)
        return
      }
      if (isDetectingRef.current) {
        detectionTimeoutRef.current = setTimeout(tick, 100)
        return
      }
      isDetectingRef.current = true
      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors()

        if (!liveActiveRef.current) return

        const frameMatches: MatchResult[] = []
        for (const detection of detections) {
          const box = detection.detection.box
          const bestMatch = matcherRef.current.findBestMatch(detection.descriptor)
          if (bestMatch.label === 'unknown') continue
          const member = membersMapRef.current.get(bestMatch.label)
          if (!member) continue
          frameMatches.push({
            member,
            distance: bestMatch.distance,
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
          })
        }

        setLiveDetections(frameMatches)
        setAccumulatedMatches((prev) => {
          let changed = false
          const next = new Map(prev)
          for (const m of frameMatches) {
            const existing = next.get(m.member.id)
            if (!existing || m.distance < existing.distance) {
              next.set(m.member.id, m)
              changed = true
            }
          }
          return changed ? next : prev
        })
      } catch {
        // 단일 프레임 실패는 무시하고 다음 틱 진행
      } finally {
        isDetectingRef.current = false
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
          // 실시간 감지 루프 시작
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

  // 누적된 인식 결과 초기화
  const clearMatches = useCallback(() => {
    setAccumulatedMatches(new Map())
  }, [])

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopLiveDetection()
      stopStream()
    }
  }, [stopStream, stopLiveDetection])

  // 누적 결과를 자동/수동으로 분류 (메모이즈)
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
