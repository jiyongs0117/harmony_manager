'use client'

import * as faceapi from 'face-api.js'

const MODEL_URL = '/models'
let modelsLoaded = false

async function ensureModels() {
  if (modelsLoaded) return
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ])
  modelsLoaded = true
}

export type PhotoQuality = {
  level: 'good' | 'warning'
  warnings: string[]
}

export type ExtractResult =
  | { success: true; descriptor: number[]; quality: PhotoQuality }
  | { success: false; reason: 'no-face' | 'load-error' | 'extract-error' }

/**
 * 사진 URL에서 128차원 얼굴 특징값(descriptor)을 추출하고 품질을 분석
 * @returns ExtractResult - 성공 시 descriptor + quality, 실패 시 reason 포함
 */
export async function extractDescriptorFromUrl(
  url: string
): Promise<ExtractResult> {
  await ensureModels()

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (!detection) {
          resolve({ success: false, reason: 'no-face' })
          return
        }

        // 품질 분석
        const quality = analyzePhotoQuality(img, detection)

        resolve({
          success: true,
          descriptor: Array.from(detection.descriptor),
          quality,
        })
      } catch {
        resolve({ success: false, reason: 'extract-error' })
      }
    }
    img.onerror = () => resolve({ success: false, reason: 'load-error' })
    img.src = url
  })
}

/**
 * 얼굴 검출 결과를 바탕으로 사진 품질을 분석
 * - 얼굴 크기 비율 (너무 작으면 원거리 인식 품질 저하)
 * - 검출 신뢰도 (낮으면 흐리거나 조명 불량)
 * - 얼굴 각도 (측면 사진이면 정면 매칭 불리)
 */
function analyzePhotoQuality(
  img: HTMLImageElement,
  detection: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>>
): PhotoQuality {
  const quality: PhotoQuality = { level: 'good', warnings: [] }

  // 1. 얼굴 크기 비율 체크
  const imgArea = img.naturalWidth * img.naturalHeight
  const box = detection.detection.box
  const faceArea = box.width * box.height
  const sizeRatio = faceArea / imgArea

  if (sizeRatio < 0.15) {
    quality.level = 'warning'
    quality.warnings.push('얼굴이 너무 작아요. 더 가까이서 찍은 사진을 사용하면 인식률이 높아져요.')
  }

  // 2. 검출 신뢰도 체크 (0.75→0.85 강화)
  const score = detection.detection.score
  if (score < 0.85) {
    quality.level = 'warning'
    quality.warnings.push('사진이 흐리거나 조명이 어두워요. 밝은 곳에서 찍은 사진을 추천해요.')
  }

  // 3. 얼굴 각도 체크 (랜드마크 기반)
  //    좌안(36-41), 우안(42-47) 중심과 코끝(30)의 수평 편차로 측면 여부 추정
  const pts = detection.landmarks.positions
  const leftEyeX  = (pts[36].x + pts[37].x + pts[38].x + pts[39].x + pts[40].x + pts[41].x) / 6
  const rightEyeX = (pts[42].x + pts[43].x + pts[44].x + pts[45].x + pts[46].x + pts[47].x) / 6
  const noseTipX  = pts[30].x
  const midEyeX   = (leftEyeX + rightEyeX) / 2
  const angleRatio = Math.abs(noseTipX - midEyeX) / box.width

  if (angleRatio > 0.10) {
    quality.level = 'warning'
    quality.warnings.push('얼굴이 옆을 향하고 있어요. 정면을 바라보는 사진을 사용하면 인식률이 높아져요.')
  }

  return quality
}

/** 실패 원인을 사용자 친화적 메시지로 변환 */
export function getExtractFailMessage(reason: 'no-face' | 'load-error' | 'extract-error'): string {
  switch (reason) {
    case 'no-face':
      return '사진에서 얼굴을 찾을 수 없어요. 얼굴이 잘 보이는 사진으로 다시 시도해 주세요.'
    case 'load-error':
      return '사진을 불러오는 데 실패했어요. 잠시 후 다시 시도해 주세요.'
    case 'extract-error':
      return '얼굴 분석 중 오류가 발생했어요. 다른 사진으로 시도해 주세요.'
  }
}
