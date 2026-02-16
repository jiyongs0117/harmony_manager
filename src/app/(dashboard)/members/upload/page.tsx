import { MemberExcelUpload } from '@/components/members/member-excel-upload'

export default function MemberUploadPage() {
  return (
    <div>
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">엑셀로 단원 등록</h2>
        <p className="text-xs text-muted mt-0.5">엑셀 파일로 여러 단원을 한번에 등록합니다</p>
      </div>
      <MemberExcelUpload />
    </div>
  )
}
