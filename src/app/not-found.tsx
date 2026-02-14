import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-muted mb-4">404</h1>
        <h2 className="text-lg font-semibold text-foreground mb-2">페이지를 찾을 수 없습니다</h2>
        <p className="text-sm text-muted mb-6">요청하신 페이지가 존재하지 않습니다.</p>
        <Link
          href="/members"
          className="inline-flex items-center justify-center px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          메인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
