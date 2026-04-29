/// <reference lib="webworker" />

// 얼굴 검출/매칭 전용 Web Worker
// - main thread는 카메라 프레임을 ImageBitmap으로 transfer만 하고 즉시 반환
// - 무거운 SSD 검출 + 디스크립터 + 매칭은 모두 이 worker에서 수행
import * as faceapi from '@vladmandic/face-api'

// Worker는 browser도 nodejs도 아니라서 face-api 자동 환경 감지가 실패함
// (getEnv - environment is not defined). Worker용 globals로 env를 명시 설정.
function setupWorkerEnv() {
  const workerEnv = {
    Canvas: OffscreenCanvas as unknown as typeof HTMLCanvasElement,
    CanvasRenderingContext2D:
      (typeof OffscreenCanvasRenderingContext2D !== 'undefined'
        ? OffscreenCanvasRenderingContext2D
        : (class {} as unknown)) as typeof CanvasRenderingContext2D,
    Image:
      (typeof ImageBitmap !== 'undefined'
        ? ImageBitmap
        : (class {} as unknown)) as typeof HTMLImageElement,
    ImageData: ImageData,
    Video: class {} as unknown as typeof HTMLVideoElement,
    createCanvasElement: () =>
      new OffscreenCanvas(1, 1) as unknown as HTMLCanvasElement,
    createImageElement: () => {
      throw new Error('createImageElement not available in worker')
    },
    createVideoElement: () => {
      throw new Error('createVideoElement not available in worker')
    },
    fetch: (url: string, init?: RequestInit) => {
      // Worker fetch는 상대 URL을 거부하므로 self.location 기준으로 절대화
      const absolute = /^(https?:|blob:|data:)/.test(url)
        ? url
        : new URL(url, self.location.href).href
      return self.fetch(absolute, init)
    },
    readFile: () => Promise.reject(new Error('readFile not available in worker')),
  }
  faceapi.env.setEnv(workerEnv as unknown as faceapi.Environment)
}

let matcher: faceapi.FaceMatcher | null = null

type Box = { x: number; y: number; width: number; height: number }
type Match = { memberId: string; distance: number; box: Box }

type IncomingMessage =
  | { type: 'init'; modelUrl: string }
  | { type: 'set-matcher'; labeled: { id: string; descriptors: number[][] }[]; threshold: number }
  | { type: 'detect'; frame: ImageBitmap; frameId: number; minConfidence: number }

type OutgoingMessage =
  | { type: 'init-done' }
  | { type: 'init-error'; error: string }
  | { type: 'matcher-set' }
  | { type: 'detect-result'; frameId: number; matches: Match[] }
  | { type: 'detect-error'; frameId: number; error: string }

const post = (msg: OutgoingMessage) => (self as unknown as Worker).postMessage(msg)

self.addEventListener('message', async (e: MessageEvent<IncomingMessage>) => {
  const msg = e.data

  if (msg.type === 'init') {
    try {
      // 모델 로드 전에 Worker용 env를 등록 (필수)
      setupWorkerEnv()

      // face-api는 첫 호출 시 tfjs 백엔드를 자동 초기화 (Worker에서 WebGL 가능 시 자동 사용,
      // 미지원 환경에서는 CPU로 폴백)
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(msg.modelUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(msg.modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(msg.modelUrl),
      ])
      post({ type: 'init-done' })
    } catch (err) {
      post({ type: 'init-error', error: err instanceof Error ? err.message : String(err) })
    }
    return
  }

  if (msg.type === 'set-matcher') {
    const labeled = msg.labeled.map((l) =>
      new faceapi.LabeledFaceDescriptors(
        l.id,
        l.descriptors.map((d) => new Float32Array(d))
      )
    )
    matcher = labeled.length > 0 ? new faceapi.FaceMatcher(labeled, msg.threshold) : null
    post({ type: 'matcher-set' })
    return
  }

  if (msg.type === 'detect') {
    const { frame, frameId, minConfidence } = msg
    try {
      if (!matcher) {
        post({ type: 'detect-result', frameId, matches: [] })
        return
      }

      // face-api의 awaitMediaLoaded는 입력이 Canvas instance가 아니면 addEventListener를 호출함.
      // ImageBitmap엔 addEventListener가 없어 실패하므로, OffscreenCanvas에 그려 전달.
      const canvas = new OffscreenCanvas(frame.width, frame.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        post({ type: 'detect-result', frameId, matches: [] })
        return
      }
      ctx.drawImage(frame, 0, 0)

      const detections = await faceapi
        .detectAllFaces(
          canvas as unknown as faceapi.TNetInput,
          new faceapi.SsdMobilenetv1Options({ minConfidence })
        )
        .withFaceLandmarks()
        .withFaceDescriptors()

      const matches: Match[] = []
      for (const det of detections) {
        const best = matcher.findBestMatch(det.descriptor)
        if (best.label === 'unknown') continue
        const box = det.detection.box
        matches.push({
          memberId: best.label,
          distance: best.distance,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        })
      }
      post({ type: 'detect-result', frameId, matches })
    } catch (err) {
      post({
        type: 'detect-error',
        frameId,
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      frame.close()
    }
  }
})

export {}
