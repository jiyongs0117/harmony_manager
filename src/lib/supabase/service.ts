import { createClient } from '@supabase/supabase-js'

/**
 * 서비스 롤 Supabase 클라이언트
 * RLS를 우회하므로 반드시 서버 사이드(Server Actions, Route Handlers)에서만 사용할 것
 * 클라이언트 컴포넌트에서 절대 import 금지
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
