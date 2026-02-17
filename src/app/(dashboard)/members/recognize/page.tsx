import { createClient } from '@/lib/supabase/server'
import { FaceRecognition } from '@/components/members/face-recognition'
import type { MemberWithPhoto } from '@/hooks/use-face-recognition'

export default async function RecognizePage() {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('members')
    .select('id, name, department, part, group_number, photo_url')
    .eq('is_active', true)
    .not('photo_url', 'is', null)
    .order('name')

  return <FaceRecognition members={(members ?? []) as MemberWithPhoto[]} />
}
