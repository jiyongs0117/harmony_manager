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

export type ExtractResult =
  | { success: true; descriptor: number[] }
  | { success: false; reason: 'no-face' | 'load-error' | 'extract-error' }

/**
 * 사진 URL에서 128차원 얼굴 특징값(descriptor)을 추출
 * @returns ExtractResult - 성공 시 descriptor, 실패 시 reason 포함
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
        if (detection) {
          resolve({ success: true, descriptor: Array.from(detection.descriptor) })
        } else {
          resolve({ success: false, reason: 'no-face' })
        }
      } catch {
        resolve({ success: false, reason: 'extract-error' })
      }
    }
    img.onerror = () => resolve({ success: false, reason: 'load-error' })
    img.src = url
  })
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
