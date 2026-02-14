import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">접근 권한 없음</h1>
        <p className="text-sm text-muted mb-6">
          등록된 파트장 계정이 아닙니다.<br />
          관리자에게 문의해주세요.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          로그인 페이지로 돌아가기
        </Link>
      </div>
    </div>
  )
}
