'use client'

import { useEffect, useState } from 'react'

export function KakaoBrowserGuide() {
  const [isKakao, setIsKakao] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    setIsKakao(/KAKAOTALK/i.test(ua))
    setIsAndroid(/Android/i.test(ua))
  }, [])

  if (!isKakao) return null

  function handleOpenExternal() {
    const currentUrl = window.location.href

    if (isAndroid) {
      // Android: Chrome intent로 강제 오픈
      const intentUrl = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
      window.location.href = intentUrl
    } else {
      // iOS: 클립보드에 복사 (Safari로 직접 이동 불가)
      navigator.clipboard?.writeText(currentUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      })
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center px-6 gap-8">
      {/* 아이콘 */}
      <div className="w-20 h-20 rounded-full bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
        <svg className="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>

      {/* 안내 메시지 */}
      <div className="text-center flex flex-col gap-2">
        <p className="text-white font-bold text-xl">외부 브라우저에서 열어주세요</p>
        <p className="text-white/50 text-sm leading-relaxed">
          카카오톡 내부 브라우저에서는<br />
          카메라 기능을 사용할 수 없습니다.
        </p>
      </div>

      {/* 버튼 */}
      <div className="w-full flex flex-col gap-3">
        <button
          onClick={handleOpenExternal}
          className="w-full bg-white text-black font-semibold py-4 rounded-xl text-base active:scale-95 transition-transform"
        >
          {isAndroid ? 'Chrome으로 열기' : 'URL 복사하기'}
        </button>

        {copied && (
          <p className="text-green-400 text-sm text-center">
            ✓ 복사됐습니다. Safari 주소창에 붙여넣어 주세요.
          </p>
        )}

        {!isAndroid && !copied && (
          <p className="text-white/30 text-xs text-center leading-relaxed">
            URL을 복사한 뒤 Safari 브라우저를 열고<br />
            주소창에 붙여넣어 주세요.
          </p>
        )}
      </div>
    </div>
  )
}
