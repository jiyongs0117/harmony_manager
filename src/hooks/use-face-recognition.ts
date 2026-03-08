'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import * as faceapi from 'face-api.js'

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
  | 'detecting'
  | 'error'

const MODEL_URL = '/models'
const DETECTION_INTERVAL_MS = 500
const MATCH_THRESHOLD = 0.45       // 이 이상이면 무시 (< 85% 신뢰)
const AUTO_CHECK_THRESHOLD = 0.30  // 이 이하면 자동 출석 체크 (≥ 95% 신뢰)
const UPSCALE_FACTOR = 1.5         // 작은 얼굴(멀리 있는 사람) 탐지를 위해 프레임 업스케일

export function useFaceRecognition(members: MemberWithPhoto[]) {
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [skippedMembers, setSkippedMembers] = useState<MemberWithPhoto[]>([])
  const [autoMatches, setAutoMatches] = useState<MatchResult[]>([])    // 자동 체크 대상 (거리 ≤ 0.35)
  const [manualMatches, setManualMatches] = useState<MatchResult[]>([]) // 수동 체크 대상 (0.35 < 거리 ≤ 0.5)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const matcherRef = useRef<faceapi.FaceMatcher | null>(null)
  const animFrameRef = useRef<number>(0)
  const lastDetectionRef = useRef<number>(0)
  const isDetectingRef = useRef(false)
  const membersMapRef = useRef<Map<string, MemberWithPhoto>>(new Map())
  const upscaleCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Load models on mount
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

        // Build descriptors
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

          // face_descriptors(다각도, 복수) 우선 사용, 없으면 face_descriptor(단일) 폴백
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
          matcherRef.current = new faceapi.FaceMatcher(
            labeledDescriptors,
            MATCH_THRESHOLD
          )
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

    return () => {
      cancelled = true
    }
  }, [members])

  // Pause detection when tab is hidden
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        isDetectingRef.current = false
      } else if (status === 'detecting') {
        isDetectingRef.current = true
        detectLoop()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  function detectLoop() {
    if (!isDetectingRef.current) return

    animFrameRef.current = requestAnimationFrame(async () => {
      const now = Date.now()
      if (now - lastDetectionRef.current < DETECTION_INTERVAL_MS) {
        detectLoop()
        return
      }
      lastDetectionRef.current = now

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        detectLoop()
        return
      }

      const displaySize = { width: video.videoWidth, height: video.videoHeight }
      faceapi.matchDimensions(canvas, displaySize)

      try {
        // 멀리 있는 작은 얼굴도 탐지하기 위해 업스케일된 캔버스에서 탐지
        if (!upscaleCanvasRef.current) {
          upscaleCanvasRef.current = document.createElement('canvas')
        }
        const upscaleCanvas = upscaleCanvasRef.current
        upscaleCanvas.width = Math.round(video.videoWidth * UPSCALE_FACTOR)
        upscaleCanvas.height = Math.round(video.videoHeight * UPSCALE_FACTOR)
        const upscaleCtx = upscaleCanvas.getContext('2d')
        if (upscaleCtx) {
          upscaleCtx.drawImage(video, 0, 0, upscaleCanvas.width, upscaleCanvas.height)
        }

        const detections = await faceapi
          .detectAllFaces(upscaleCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
          .withFaceLandmarks()
          .withFaceDescriptors()

        // 업스케일된 좌표를 원본 비디오 크기로 변환
        const resized = faceapi.resizeResults(detections, displaySize)

        // Clear canvas
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }

        const newAutoMatches: MatchResult[] = []
        const newManualMatches: MatchResult[] = []

        for (const detection of resized) {
          const box = detection.detection.box

          if (matcherRef.current) {
            const bestMatch = matcherRef.current.findBestMatch(detection.descriptor)

            if (bestMatch.label !== 'unknown') {
              const member = membersMapRef.current.get(bestMatch.label)
              if (member) {
                const matchResult: MatchResult = {
                  member,
                  distance: bestMatch.distance,
                  box: { x: box.x, y: box.y, width: box.width, height: box.height },
                }

                const isAutoMatch = bestMatch.distance <= AUTO_CHECK_THRESHOLD

                if (isAutoMatch) {
                  newAutoMatches.push(matchResult)
                } else {
                  newManualMatches.push(matchResult)
                }

                // 자동 체크: 초록 박스 / 수동 체크: 주황 박스
                if (ctx) {
                  const color = isAutoMatch ? '#22c55e' : '#f59e0b'
                  ctx.strokeStyle = color
                  ctx.lineWidth = 3
                  ctx.strokeRect(box.x, box.y, box.width, box.height)

                  const label = [member.part, member.group_number ? `${member.group_number}` : '', member.name]
                    .filter(Boolean)
                    .join(' ')

                  ctx.fillStyle = color
                  ctx.font = '14px sans-serif'
                  const textWidth = ctx.measureText(label).width
                  ctx.fillRect(box.x, box.y - 24, textWidth + 16, 24)

                  ctx.fillStyle = '#ffffff'
                  ctx.fillText(label, box.x + 8, box.y - 7)
                }
              }
            }
            // 80% 미만(unknown) 얼굴은 아무것도 그리지 않음
          }
        }

        setAutoMatches(newAutoMatches)
        setManualMatches(newManualMatches)
      } catch {
        // Detection error, continue loop
      }

      detectLoop()
    })
  }

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
          videoRef.current?.play()
          setStatus('detecting')
          isDetectingRef.current = true
          lastDetectionRef.current = 0
          detectLoop()
        }
      }
    } catch {
      setErrorMessage('카메라 권한이 필요합니다. 브라우저 설정에서 카메라 접근을 허용해주세요.')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopCamera = useCallback(() => {
    isDetectingRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    setAutoMatches([])
    setManualMatches([])

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setStatus('ready')
  }, [])

  const flipCamera = useCallback(async () => {
    stopCamera()
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    await startCamera(newMode)
  }, [facingMode, stopCamera, startCamera])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isDetectingRef.current = false
      cancelAnimationFrame(animFrameRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return {
    status,
    progress,
    skippedMembers,
    autoMatches,
    manualMatches,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    flipCamera,
    errorMessage,
    facingMode,
  }
}
