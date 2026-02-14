-- =============================================
-- 성가대 관리 시스템 - 초기 스키마
-- =============================================

-- Enum 타입 생성
CREATE TYPE department_type AS ENUM ('1부', '2부', '3부', '4부', '5부');
CREATE TYPE part_type AS ENUM ('소프라노', '알토', '테너', '베이스');
CREATE TYPE church_position_type AS ENUM ('장로', '안수집사', '집사', '평신도');
CREATE TYPE gender_type AS ENUM ('남', '여');
CREATE TYPE attendance_status_type AS ENUM ('출석', '결석', '사전불참');

-- =============================================
-- 테이블 생성
-- =============================================

-- 파트장 (리더) 테이블
CREATE TABLE leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  department department_type NOT NULL,
  part part_type NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_leaders_email ON leaders(email);
CREATE INDEX idx_leaders_auth_user_id ON leaders(auth_user_id);

-- 성가대원 테이블
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department department_type NOT NULL,
  part part_type NOT NULL,
  group_number text,
  date_of_birth date,
  choir_join_date date,
  church_registration_date date,
  church_position church_position_type,
  mission_association_name text,
  mission_association_position text,
  gender gender_type,
  address text,
  prayer_request text,
  photo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES leaders(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_members_dept_part ON members(department, part);
CREATE INDEX idx_members_active ON members(is_active);
CREATE INDEX idx_members_name ON members(name);

-- 출석 이벤트 테이블
CREATE TABLE attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_date date NOT NULL,
  department department_type NOT NULL,
  part part_type NOT NULL,
  created_by uuid NOT NULL REFERENCES leaders(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_events_dept_part_date ON attendance_events(department, part, event_date DESC);

-- 출석 기록 테이블
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES attendance_events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status attendance_status_type NOT NULL DEFAULT '결석',
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, member_id)
);

CREATE INDEX idx_records_event ON attendance_records(event_id);
CREATE INDEX idx_records_member ON attendance_records(member_id);
CREATE INDEX idx_records_status ON attendance_records(status);

-- =============================================
-- updated_at 자동 갱신 트리거
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_leaders_updated_at
  BEFORE UPDATE ON leaders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_members_updated_at
  BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON attendance_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_records_updated_at
  BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- RLS 헬퍼 함수
-- =============================================

CREATE OR REPLACE FUNCTION get_leader_department()
RETURNS department_type AS $$
  SELECT department FROM leaders WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_leader_part()
RETURNS part_type AS $$
  SELECT part FROM leaders WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_leader_id()
RETURNS uuid AS $$
  SELECT id FROM leaders WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- Row Level Security (RLS) 정책
-- =============================================

-- Leaders 테이블
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaders_select_own"
  ON leaders FOR SELECT
  USING (auth_user_id = auth.uid());

-- 이메일 기반 조회 허용 (첫 로그인 시 auth_user_id 연결 전 필요)
CREATE POLICY "leaders_select_by_email"
  ON leaders FOR SELECT
  USING (email = auth.jwt() ->> 'email');

CREATE POLICY "leaders_update_own"
  ON leaders FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- 이메일 기반 업데이트 허용 (첫 로그인 시 auth_user_id 연결 용도)
CREATE POLICY "leaders_update_by_email"
  ON leaders FOR UPDATE
  USING (email = auth.jwt() ->> 'email')
  WITH CHECK (email = auth.jwt() ->> 'email');

-- Members 테이블
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_own_dept_part"
  ON members FOR SELECT
  USING (department = get_leader_department() AND part = get_leader_part());

CREATE POLICY "members_insert_own_dept_part"
  ON members FOR INSERT
  WITH CHECK (department = get_leader_department() AND part = get_leader_part());

CREATE POLICY "members_update_own_dept_part"
  ON members FOR UPDATE
  USING (department = get_leader_department() AND part = get_leader_part())
  WITH CHECK (department = get_leader_department() AND part = get_leader_part());

CREATE POLICY "members_delete_own_dept_part"
  ON members FOR DELETE
  USING (department = get_leader_department() AND part = get_leader_part());

-- Attendance Events 테이블
ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select_own_dept_part"
  ON attendance_events FOR SELECT
  USING (department = get_leader_department() AND part = get_leader_part());

CREATE POLICY "events_insert_own_dept_part"
  ON attendance_events FOR INSERT
  WITH CHECK (department = get_leader_department() AND part = get_leader_part());

CREATE POLICY "events_update_own"
  ON attendance_events FOR UPDATE
  USING (created_by = get_leader_id());

CREATE POLICY "events_delete_own"
  ON attendance_events FOR DELETE
  USING (created_by = get_leader_id());

-- Attendance Records 테이블
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "records_select_own_dept_part"
  ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attendance_events ae
      WHERE ae.id = attendance_records.event_id
      AND ae.department = get_leader_department()
      AND ae.part = get_leader_part()
    )
  );

CREATE POLICY "records_insert_own_dept_part"
  ON attendance_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM attendance_events ae
      WHERE ae.id = attendance_records.event_id
      AND ae.department = get_leader_department()
      AND ae.part = get_leader_part()
    )
  );

CREATE POLICY "records_update_own_dept_part"
  ON attendance_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM attendance_events ae
      WHERE ae.id = attendance_records.event_id
      AND ae.department = get_leader_department()
      AND ae.part = get_leader_part()
    )
  );

CREATE POLICY "records_delete_own_dept_part"
  ON attendance_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM attendance_events ae
      WHERE ae.id = attendance_records.event_id
      AND ae.department = get_leader_department()
      AND ae.part = get_leader_part()
    )
  );

-- =============================================
-- Storage 버킷 생성
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-photos', 'member-photos', true);

CREATE POLICY "Authenticated users can upload member photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'member-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Public read access for member photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-photos');

CREATE POLICY "Authenticated users can update member photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'member-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete member photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'member-photos' AND auth.role() = 'authenticated');
