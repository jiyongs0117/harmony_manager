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

/**
 * 사진 URL에서 128차원 얼굴 특징값(descriptor)을 추출
 * @returns number[] (128개 float) 또는 null (얼굴 미감지)
 */
export async function extractDescriptorFromUrl(
  url: string
): Promise<number[] | null> {
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
        resolve(detection ? Array.from(detection.descriptor) : null)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}
