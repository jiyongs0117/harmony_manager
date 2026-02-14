import { MemberForm } from '@/components/members/member-form'

export default function NewMemberPage() {
  return (
    <div>
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">단원 등록</h2>
      </div>
      <MemberForm mode="create" />
    </div>
  )
}
