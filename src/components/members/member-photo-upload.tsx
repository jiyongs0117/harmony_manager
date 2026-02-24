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
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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

      const { data: urlData } = supabase.storage
        .from('member-photos')
        .getPublicUrl(data.path)

      const publicUrl = urlData.publicUrl
      setPreviewUrl(publicUrl)
      onUpload(publicUrl)
      setUploading(false)

      // 업로드 완료 후 descriptor 추출
      if (onDescriptor) {
        setExtracting(true)
        setExtractError(null)
        try {
          const result = await extractDescriptorFromUrl(publicUrl)
          if (result.success) {
            onDescriptor(result.descriptor)
          } else {
            setExtractError(getExtractFailMessage(result.reason))
            onDescriptor(null)
          }
        } catch {
          setExtractError('얼굴 분석 중 오류가 발생했어요. 다른 사진으로 시도해 주세요.')
          onDescriptor(null)
        } finally {
          setExtracting(false)
        }
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
