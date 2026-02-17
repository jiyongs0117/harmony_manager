'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import * as faceapi from 'face-api.js'
import {
  getCachedDescriptor,
  setCachedDescriptor,
} from '@/lib/face-descriptors'

export interface MemberWithPhoto {
  id: string
  name: string
  department: string
  part: string
  group_number: string | null
  photo_url: string
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
const MATCH_THRESHOLD = 0.6

export function useFaceRecognition(members: MemberWithPhoto[]) {
  const [status, setStatus] = useState<RecognitionStatus>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [skippedMembers, setSkippedMembers] = useState<MemberWithPhoto[]>([])
  const [matches, setMatches] = useState<MatchResult[]>([])
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

          // Try cache first
          const cached = await getCachedDescriptor(member.id, member.photo_url)
          if (cached) {
            labeledDescriptors.push(
              new faceapi.LabeledFaceDescriptors(member.id, [cached])
            )
            setProgress({ current: i + 1, total })
            continue
          }

          // Extract descriptor from photo
          try {
            const descriptor = await extractDescriptorFromUrl(member.photo_url)
            if (descriptor) {
              await setCachedDescriptor(member.id, member.photo_url, descriptor)
              labeledDescriptors.push(
                new faceapi.LabeledFaceDescriptors(member.id, [descriptor])
              )
            } else {
              skipped.push(member)
            }
          } catch {
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
  }, [status])

  async function extractDescriptorFromUrl(
    url: string
  ): Promise<Float32Array | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = async () => {
        try {
          const detection = await faceapi
            .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
            .withFaceLandmarks()
            .withFaceDescriptor()
          resolve(detection ? detection.descriptor : null)
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

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
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
          .withFaceLandmarks()
          .withFaceDescriptors()

        const resized = faceapi.resizeResults(detections, displaySize)

        // Clear canvas
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }

        const newMatches: MatchResult[] = []

        for (const detection of resized) {
          const box = detection.detection.box

          if (matcherRef.current) {
            const bestMatch = matcherRef.current.findBestMatch(detection.descriptor)

            if (bestMatch.label !== 'unknown') {
              const member = membersMapRef.current.get(bestMatch.label)
              if (member) {
                newMatches.push({
                  member,
                  distance: bestMatch.distance,
                  box: { x: box.x, y: box.y, width: box.width, height: box.height },
                })

                // Draw green box with name
                if (ctx) {
                  ctx.strokeStyle = '#22c55e'
                  ctx.lineWidth = 3
                  ctx.strokeRect(box.x, box.y, box.width, box.height)

                  ctx.fillStyle = '#22c55e'
                  const textWidth = ctx.measureText(member.name).width
                  ctx.fillRect(box.x, box.y - 24, textWidth + 16, 24)

                  ctx.fillStyle = '#ffffff'
                  ctx.font = '14px sans-serif'
                  ctx.fillText(member.name, box.x + 8, box.y - 7)
                }
              }
            } else {
              // Draw gray box for unknown face
              if (ctx) {
                ctx.strokeStyle = '#9ca3af'
                ctx.lineWidth = 2
                ctx.strokeRect(box.x, box.y, box.width, box.height)
              }
            }
          }
        }

        setMatches(newMatches)
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
        video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
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
  }, [])

  const stopCamera = useCallback(() => {
    isDetectingRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    setMatches([])

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
    matches,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    flipCamera,
    errorMessage,
    facingMode,
  }
}
