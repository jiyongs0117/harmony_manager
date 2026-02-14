'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'

interface MemberPhotoUploadProps {
  currentUrl: string | null
  memberName: string
  onUpload: (url: string) => void
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

export function MemberPhotoUpload({ currentUrl, memberName, onUpload }: MemberPhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

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

      setPreviewUrl(urlData.publicUrl)
      onUpload(urlData.publicUrl)
    } catch {
      alert('사진 업로드에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-border flex items-center justify-center',
          uploading && 'opacity-50'
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={memberName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-semibold text-muted">
            {memberName ? getInitials(memberName) : '+'}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs text-primary font-medium"
      >
        {uploading ? '업로드 중...' : '사진 변경'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
