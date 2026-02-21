-- =============================================
-- attendance_records 테이블에 checked_at 컬럼 추가
-- 출석 처리된 시각을 기록
-- =============================================

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS checked_at timestamptz;
