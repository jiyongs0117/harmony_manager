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
  | 'viewfinder'  // 카메라 활성화, 촬영 대기
  | 'capturing'   // 사진 분석 중
  | 'results'     // 결과 표시
  | 'error'

const MODEL_URL = '/models'
const MATCH_THRESHOLD = 0.45       // 이 이상이면 무시
const AUTO_CHECK_THRESHOLD = 0.30  // 이 이하면 자동 출석 (녹색)

export function useFaceRecognition(members: MemberWithPhoto[]) {
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [skippedMembers, setSkippedMembers] = useState<MemberWithPhoto[]>([])
  const [autoMatches, setAutoMatches] = useState<MatchResult[]>([])
  const [manualMatches, setManualMatches] = useState<MatchResult[]>([])
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const matcherRef = useRef<faceapi.FaceMatcher | null>(null)
  const membersMapRef = useRef<Map<string, MemberWithPhoto>>(new Map())

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

  // 스트림만 종료 (상태 변경 없음)
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
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
          videoRef.current?.play()
          setStatus('viewfinder')
        }
      }
    } catch {
      setErrorMessage('카메라 권한이 필요합니다. 브라우저 설정에서 카메라 접근을 허용해주세요.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    stopStream()
    setAutoMatches([])
    setManualMatches([])
    setResultImageUrl(null)
    setStatus('ready')
  }, [stopStream])

  const flipCamera = useCallback(async () => {
    stopStream()
    const newMode = facingMode === 'user' ? 'environment' : 'user'
    await startCamera(newMode)
  }, [facingMode, stopStream, startCamera])

  // 사진 촬영 후 전체 인식
  const captureAndRecognize = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return

    setStatus('capturing')

    // 현재 프레임 캡처
    const captureCanvas = document.createElement('canvas')
    captureCanvas.width = video.videoWidth
    captureCanvas.height = video.videoHeight
    const ctx = captureCanvas.getContext('2d')
    if (!ctx) { setStatus('viewfinder'); return }
    ctx.drawImage(video, 0, 0)

    // 카메라 스트림 종료
    stopStream()

    try {
      const detections = await faceapi
        .detectAllFaces(captureCanvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
        .withFaceLandmarks()
        .withFaceDescriptors()

      const newAutoMatches: MatchResult[] = []
      const newManualMatches: MatchResult[] = []

      for (const detection of detections) {
        const box = detection.detection.box
        if (!matcherRef.current) continue

        const bestMatch = matcherRef.current.findBestMatch(detection.descriptor)
        if (bestMatch.label === 'unknown') continue

        const member = membersMapRef.current.get(bestMatch.label)
        if (!member) continue

        const isAuto = bestMatch.distance <= AUTO_CHECK_THRESHOLD
        const matchResult: MatchResult = {
          member,
          distance: bestMatch.distance,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        }

        if (isAuto) {
          newAutoMatches.push(matchResult)
        } else {
          newManualMatches.push(matchResult)
        }

        // 박스 그리기는 컴포넌트의 CSS 오버레이에서 처리
      }

      setAutoMatches(newAutoMatches)
      setManualMatches(newManualMatches)
      setResultImageUrl(captureCanvas.toDataURL('image/jpeg', 0.92))
      setStatus('results')
    } catch {
      setStatus('error')
      setErrorMessage('얼굴 인식 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }, [stopStream])

  // 다시 찍기
  const retake = useCallback(() => {
    setAutoMatches([])
    setManualMatches([])
    setResultImageUrl(null)
    startCamera(facingMode)
  }, [facingMode, startCamera])

  // 언마운트 시 정리
  useEffect(() => {
    return () => { stopStream() }
  }, [stopStream])

  return {
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
    facingMode,
  }
}
