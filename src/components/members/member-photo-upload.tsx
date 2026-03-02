'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import { extractDescriptorFromUrl, getExtractFailMessage } from '@/lib/face-extract'

interface MemberPhotoUploadProps {
  currentUrl: string | null
  memberName: string
  onUpload: (url: string) => void
  onDescriptor?: (descriptor: number[] | null) => void
}

async function resizeImage(file: File, maxWidth = 800): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(blob!),
        'image/jpeg',
        0.8
      )
    }

    img.src = URL.createObjectURL(file)
  })
}

export function MemberPhotoUpload({ currentUrl, memberName, onUpload, onDescriptor }: MemberPhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [qualityWarnings, setQualityWarnings] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExtractError(null)
    setQualityWarnings([])
    setUploading(true)

    try {
      const resized = await resizeImage(file)
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('member-photos')
        .upload(fileName, resized, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (error) throw error

      const uploadedPath = data.path
      const { data: urlData } = supabase.storage
        .from('member-photos')
        .getPublicUrl(uploadedPath)

      const publicUrl = urlData.publicUrl
      setUploading(false)
      setExtracting(true)

      try {
        const result = await extractDescriptorFromUrl(publicUrl)
        if (result.success) {
          // 특징점 확보 성공 → 사진 등록 (품질 경고는 비차단)
          setPreviewUrl(publicUrl)
          onUpload(publicUrl)
          onDescriptor?.(result.descriptor)
          if (result.quality.level === 'warning') {
            setQualityWarnings(result.quality.warnings)
          }
        } else {
          // 특징점 확보 실패 → 업로드 파일 삭제, 사진 등록 안 함
          await supabase.storage.from('member-photos').remove([uploadedPath])
          setExtractError(getExtractFailMessage(result.reason))
        }
      } catch {
        await supabase.storage.from('member-photos').remove([uploadedPath])
        setExtractError('얼굴 분석 중 오류가 발생했어요. 다른 사진으로 시도해 주세요.')
      } finally {
        setExtracting(false)
      }
    } catch {
      alert('사진 업로드에 실패했습니다')
      setUploading(false)
    }
  }

  const isLoading = uploading || extracting

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-border flex items-center justify-center',
          isLoading && 'opacity-50'
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={memberName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-semibold text-muted">
            {memberName ? getInitials(memberName) : '+'}
          </span>
        )}
      </div>
      {isLoading ? (
        <span className="text-xs text-muted">
          {uploading ? '업로드 중...' : '얼굴 분석 중...'}
        </span>
      ) : (
        <>
          {extractError && (
            <p className="text-xs text-destructive text-center max-w-[180px] leading-tight">
              ⚠️ {extractError}
            </p>
          )}
          {qualityWarnings.length > 0 && (
            <div className="max-w-[200px] rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex flex-col gap-1">
              <p className="text-xs font-medium text-amber-700">📸 사진 품질 안내</p>
              {qualityWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 leading-tight">• {w}</p>
              ))}
            </div>
          )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="text-xs text-primary font-medium"
          >
            촬영
          </button>
          <button
            type="button"
            onClick={() => albumRef.current?.click()}
            className="text-xs text-primary font-medium"
          >
            앨범
          </button>
        </div>
        </>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
