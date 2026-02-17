'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { createMembersBulk } from '@/actions/members-upload'

interface ParsedRow {
  name: string
  gender: string | null
  group_number: string | null
  date_of_birth: string | null
  choir_join_date: string | null
  church_registration_date: string | null
  church_position: string | null
  mission_association_name: string | null
  mission_association_position: string | null
  address: string | null
  phone_number: string | null
  prayer_request: string | null
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  '이름': 'name',
  '성별': 'gender',
  '조': 'group_number',
  '조번호': 'group_number',
  '생년월일': 'date_of_birth',
  '성가대 가입일': 'choir_join_date',
  '가입일': 'choir_join_date',
  '등록일': 'church_registration_date',
  '교회 등록일': 'church_registration_date',
  '직분': 'church_position',
  '교회직분': 'church_position',
  '선교회': 'mission_association_name',
  '선교회 이름': 'mission_association_name',
  '선교회명': 'mission_association_name',
  '선교회 직분': 'mission_association_position',
  '선교회직분': 'mission_association_position',
  '주소': 'address',
  '휴대폰번호': 'phone_number',
  '휴대폰': 'phone_number',
  '전화번호': 'phone_number',
  '연락처': 'phone_number',
  '기도제목': 'prayer_request',
}

function excelDateToString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  // Excel serial date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) {
      const y = date.y
      const m = String(date.m).padStart(2, '0')
      const d = String(date.d).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }
  const str = String(value).trim()
  if (!str) return null
  // Try to parse common date formats: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const match = str.match(/^(\d{4})[-/.년](\d{1,2})[-/.월](\d{1,2})일?$/)
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  }
  return str
}

function cellToString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim() || null
}

function parseExcelData(data: ArrayBuffer): { rows: ParsedRow[]; error?: string } {
  try {
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { rows: [], error: '시트를 찾을 수 없습니다' }

    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rawRows.length === 0) return { rows: [], error: '데이터가 없습니다' }

    // Map column headers
    const headers = Object.keys(rawRows[0])
    const mapping: Record<string, keyof ParsedRow> = {}
    for (const header of headers) {
      const normalized = header.trim()
      if (COLUMN_MAP[normalized]) {
        mapping[header] = COLUMN_MAP[normalized]
      }
    }

    if (!Object.values(mapping).includes('name')) {
      return { rows: [], error: "'이름' 열을 찾을 수 없습니다. 엑셀 파일의 첫 번째 행에 '이름' 헤더가 필요합니다." }
    }

    const DATE_FIELDS: (keyof ParsedRow)[] = ['date_of_birth', 'choir_join_date', 'church_registration_date']

    const rows: ParsedRow[] = rawRows
      .map((raw) => {
        const row: ParsedRow = {
          name: '',
          gender: null,
          group_number: null,
          date_of_birth: null,
          choir_join_date: null,
          church_registration_date: null,
          church_position: null,
          mission_association_name: null,
          mission_association_position: null,
          address: null,
          phone_number: null,
          prayer_request: null,
        }

        for (const [header, field] of Object.entries(mapping)) {
          const value = raw[header]
          if (field === 'name') {
            row.name = cellToString(value) ?? ''
          } else {
            const parsed = DATE_FIELDS.includes(field) ? excelDateToString(value) : cellToString(value)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(row as any)[field] = parsed
          }
        }

        return row
      })
      .filter((row) => row.name && row.name.trim().length > 0)

    return { rows }
  } catch {
    return { rows: [], error: '엑셀 파일을 읽을 수 없습니다. .xlsx 또는 .xls 형식을 확인해주세요.' }
  }
}

const PREVIEW_COLUMNS = [
  { key: 'name', label: '이름' },
  { key: 'gender', label: '성별' },
  { key: 'group_number', label: '조' },
  { key: 'phone_number', label: '휴대폰번호' },
  { key: 'church_position', label: '직분' },
] as const

export function MemberExcelUpload() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [parseError, setParseError] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParseError('')
    setParsedRows([])
    setFileName(file.name)

    const buffer = await file.arrayBuffer()
    const { rows, error } = parseExcelData(buffer)

    if (error) {
      setParseError(error)
      return
    }

    if (rows.length === 0) {
      setParseError('유효한 데이터가 없습니다. 이름이 입력된 행이 있는지 확인해주세요.')
      return
    }

    setParsedRows(rows)
  }

  const handleUpload = async () => {
    if (parsedRows.length === 0) return

    setIsUploading(true)
    try {
      const result = await createMembersBulk(parsedRows)
      if (result.error) {
        toast(result.error, 'error')
      } else {
        toast(`${result.count}명의 단원이 등록되었습니다`, 'success')
        router.push('/members')
      }
    } catch {
      toast('업로드 중 오류가 발생했습니다', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setParsedRows([])
    setFileName('')
    setParseError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* File Upload Area */}
      <div
        className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="text-3xl mb-2">📄</div>
        {fileName ? (
          <p className="text-sm text-foreground font-medium">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">엑셀 파일을 선택해주세요</p>
            <p className="text-xs text-muted mt-1">.xlsx, .xls 형식 지원</p>
          </>
        )}
      </div>

      {/* Template Info */}
      <div className="bg-blue-50 rounded-lg p-3">
        <p className="text-xs font-medium text-blue-800 mb-1">엑셀 파일 형식 안내</p>
        <p className="text-xs text-blue-700">
          첫 번째 행에 다음 헤더를 사용해주세요:
        </p>
        <p className="text-xs text-blue-600 mt-1">
          이름(필수), 성별, 조, 생년월일, 직분, 휴대폰번호, 가입일, 등록일, 선교회, 선교회 직분, 주소, 기도제목
        </p>
      </div>

      {/* Parse Error */}
      {parseError && (
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-sm text-red-700">{parseError}</p>
        </div>
      )}

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">
              미리보기 ({parsedRows.length}명)
            </p>
            <button
              onClick={handleReset}
              className="text-xs text-muted hover:text-foreground"
            >
              초기화
            </button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted w-8">#</th>
                    {PREVIEW_COLUMNS.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      {PREVIEW_COLUMNS.map((col) => (
                        <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                          {row[col.key] || <span className="text-muted">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedRows.length > 20 && (
              <div className="px-3 py-2 text-xs text-muted bg-gray-50 border-t border-border">
                ...외 {parsedRows.length - 20}명 더
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {parsedRows.length > 0 && (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => router.back()}
          >
            취소
          </Button>
          <Button
            className="flex-1"
            onClick={handleUpload}
            isLoading={isUploading}
          >
            {parsedRows.length}명 등록
          </Button>
        </div>
      )}
    </div>
  )
}
