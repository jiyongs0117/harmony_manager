-- 파트장 시드 데이터 (이메일을 실제 파트장 이메일로 변경해주세요)
-- auth_user_id는 NULL로 두고, 첫 Google 로그인 시 자동 연결됩니다.

INSERT INTO leaders (email, name, department, part) VALUES
  ('leader1@gmail.com', '김소프라노', '1부', '소프라노'),
  ('leader2@gmail.com', '이알토', '1부', '알토'),
  ('leader3@gmail.com', '박테너', '1부', '테너'),
  ('leader4@gmail.com', '최베이스', '1부', '베이스'),
  ('leader5@gmail.com', '정소프라노', '2부', '소프라노'),
  ('leader6@gmail.com', '한알토', '2부', '알토'),
  ('leader7@gmail.com', '강테너', '2부', '테너'),
  ('leader8@gmail.com', '조베이스', '2부', '베이스'),
  ('leader9@gmail.com', '윤소프라노', '3부', '소프라노'),
  ('leader10@gmail.com', '서알토', '3부', '알토');
