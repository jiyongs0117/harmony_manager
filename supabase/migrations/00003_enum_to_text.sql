-- church_position과 gender를 enum에서 text로 변경
-- enum 타입은 유니코드 정규화 차이로 인한 매칭 오류 발생 가능
ALTER TABLE members ALTER COLUMN church_position TYPE text;
ALTER TABLE members ALTER COLUMN gender TYPE text;
