import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      // 현재 로그인한 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        // leaders 테이블에서 이메일로 파트장 확인
        const { data: leader } = await supabase
          .from('leaders')
          .select('id, auth_user_id')
          .eq('email', user.email)
          .single()

        if (!leader) {
          // 등록되지 않은 이메일 → 로그아웃 후 unauthorized 페이지로
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/unauthorized`)
        }

        // 첫 로그인 시 auth_user_id 연결
        if (!leader.auth_user_id) {
          await supabase
            .from('leaders')
            .update({ auth_user_id: user.id })
            .eq('id', leader.id)
        }
      }

      return NextResponse.redirect(`${origin}/members`)
    }
  }

  // 오류 발생 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login`)
}
