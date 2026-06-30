-- =============================================
-- FITNESS TRACKER — DATABASE SCHEMA
-- Chạy file này trong Supabase SQL Editor
-- =============================================

-- EXERCISES: danh sách bài tập và mục tiêu
CREATE TABLE IF NOT EXISTS exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  muscle_group  TEXT NOT NULL,          -- Ngực / Lưng / Vai / Tay trước / Tay sau / Chân / Core
  current_weight_kg  NUMERIC(5,2),      -- tạ hiện đang dùng
  target_reps   TEXT,                   -- vd "8-12"
  target_sets   INT,
  technique_cue TEXT,                   -- cue kỹ thuật
  notes         TEXT,
  display_order INT DEFAULT 99,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- WORKOUT_TEMPLATES: tên các buổi tập (vd "Ngực + Vai + Tay sau + Core")
CREATE TABLE IF NOT EXISTS workout_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,            -- "NGỰC + VAI + TAY SAU + CORE"
  type        TEXT NOT NULL,            -- 'strength' | 'run'
  -- Chỉ dùng cho buổi chạy:
  target_pace TEXT,                     -- "8:40–9:20"
  target_hr_range TEXT,                 -- "125–145"
  run_type    TEXT,                     -- 'easy' | 'tempo' | 'interval'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TEMPLATE_EXERCISES: bài tập trong từng buổi (theo thứ tự)
CREATE TABLE IF NOT EXISTS template_exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0
);

-- WORKOUT_SESSIONS: log từng buổi tập đã thực hiện
CREATE TABLE IF NOT EXISTS workout_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  template_id     UUID REFERENCES workout_templates(id),
  name_override   TEXT,               -- nếu không dùng template
  type            TEXT NOT NULL,      -- 'strength' | 'run'
  duration_seconds INT,
  -- Running fields:
  distance_km     NUMERIC(6,2),
  avg_pace_seconds INT,               -- giây/km để tính toán dễ
  avg_hr          INT,
  max_hr          INT,
  calories        INT,
  feeling_note    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- WORKOUT_SETS: set-by-set cho buổi tập kháng lực
CREATE TABLE IF NOT EXISTS workout_sets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number  INT NOT NULL,
  reps        INT,
  weight_kg   NUMERIC(5,2),
  rpe         NUMERIC(3,1),           -- 1–10, cho phép 7.5
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- SLEEP_RECOVERY_LOGS: nhịp tim nghỉ + giấc ngủ
CREATE TABLE IF NOT EXISTS sleep_recovery_logs (
  date                 DATE PRIMARY KEY,
  resting_hr           INT,
  hr_min               INT,
  hr_max               INT,
  sleep_score          INT,           -- điểm app trả về
  sleep_duration_min   INT,           -- tổng phút ngủ
  wake_count           INT,
  energy_level         TEXT,          -- 'Tốt' / 'Bình thường' / 'Thấp'
  note                 TEXT
);

-- NUTRITION_LOGS: dinh dưỡng theo ngày
CREATE TABLE IF NOT EXISTS nutrition_logs (
  date          DATE PRIMARY KEY,
  calories      INT,
  protein_g     NUMERIC(6,1),
  carbs_g       NUMERIC(6,1),
  fat_g         NUMERIC(6,1),
  fiber_g       NUMERIC(6,1),
  water_adequate BOOLEAN DEFAULT TRUE,
  note          TEXT
);

-- BODY_METRICS: đo hàng tuần
CREATE TABLE IF NOT EXISTS body_metrics (
  date               DATE PRIMARY KEY,
  weight_kg          NUMERIC(5,2),
  body_fat_pct       NUMERIC(5,2),
  lean_mass_kg       NUMERIC(5,2),
  waist_cm           NUMERIC(5,1),
  chest_cm           NUMERIC(5,1),
  hip_cm             NUMERIC(5,1),
  thigh_cm           NUMERIC(5,1),
  arm_cm             NUMERIC(5,1),
  neck_cm            NUMERIC(5,1),
  water_pct          NUMERIC(5,2),
  visceral_fat_level INT,
  bone_mineral_kg    NUMERIC(5,3),
  protein_pct        NUMERIC(5,2),
  skeletal_muscle_kg NUMERIC(5,2),
  bmi                NUMERIC(5,2),
  note               TEXT
);

-- =============================================
-- SEED DATA: exercises (từ Lịch tập.txt)
-- =============================================

INSERT INTO exercises (name, muscle_group, current_weight_kg, target_reps, target_sets, technique_cue) VALUES
-- Ngực
('Dumbbell Floor Press',      'Ngực',       7,    '8-12', 4, 'Ép hai tay lại gần nhau, khuỷu 45 độ – ngực căng – nghĩ "dùng ngực đẩy tạ", không phải "đẩy tạ bằng tay"'),
('Push Up',                   'Ngực',       NULL, '12-15', 3, 'Xuống: ngực mở rộng – lên: ngực bóp lại – dùng ngực đẩy lên – 2 giây xuống, 1 giây lên'),
('Close Grip Floor Press',    'Tay sau',    5,    '15',   3, 'Ép khuỷu + tạ sát người'),
-- Vai
('Dumbbell Shoulder Press',   'Vai',        7,    '8-10', 4, 'Không khóa khuỷu quá mạnh – không nhún vai lên – đẩy khuỷu tay lên trời – cảm nhận vai cháy'),
('Dumbbell Lateral Raise',    'Vai',        3,    '12-15', 4, 'Chỉ dùng vai – Vai giữa cháy, không đau cổ'),
('Arnold Press',              'Vai',        5,    '12',   3, NULL),
-- Lưng
('Bent Over Dumbbell Row',    'Lưng',       7,    '15',   4, 'Kéo cùi chỏ ra sau – siết lưng 1 giây ở đỉnh – không giật người – cảm giác lưng làm việc, không phải tay kéo'),
('One Arm Dumbbell Row',      'Lưng',       7,    '12',   4, 'Kéo lên: ~1 giây – giữ: 1 giây – hạ xuống: 2–3 giây'),
('Dumbbell Pullover',         'Lưng',       5,    '15',   3, 'Căng xô khi hạ xuống – không cần xuống quá sâu nếu vai khó chịu'),
-- Vai sau
('Rear Delt Fly',             'Vai sau',    3,    '10',   4, 'Giảm xuống 3kg để kích thích đúng nhóm cơ, không bị ăn vào trap'),
-- Tay trước
('Dumbbell Curl',             'Tay trước',  5,    '15',   3, NULL),
('Hammer Curl',               'Cẳng tay',   5,    '12',   3, NULL),
-- Tay sau
('Overhead Tricep Extension', 'Tay sau',    5,    '15',   3, 'Căng khi hạ – siết khi duỗi'),
-- Chân
('Goblet Squat',              'Chân',       7,    '10-12', 4, NULL),
('Romanian Deadlift',         'Chân',       7,    '10-12', 4, 'Căng ở sau đùi – Căng kéo dài từ gần mông xuống phía sau gối – Mông cũng có cảm giác hoạt động'),
('Reverse Lunge',             'Chân',       7,    '10',   3, NULL),
-- Core
('Dead Bug',                  'Core',       NULL, '20-30', 3, 'Bụng căng như chuẩn bị bị đấm – lưng dưới ép nhẹ xuống sàn'),
('Plank',                     'Core',       NULL, '60s',  3, 'Bụng căng – mông siết'),
('Russian Twist',             'Core',       NULL, '30',   3, NULL),
('Side Plank',                'Core',       NULL, '45s',  2, NULL),
('Reverse Crunch',            'Core',       NULL, '15',   3, NULL);

-- =============================================
-- SEED DATA: workout_templates
-- =============================================

INSERT INTO workout_templates (id, name, type) VALUES
('11111111-1111-1111-1111-111111111111', 'Ngực + Vai + Tay sau + Core', 'strength'),
('22222222-2222-2222-2222-222222222222', 'Lưng + Vai sau + Tay trước + Core', 'strength'),
('33333333-3333-3333-3333-333333333333', 'Leg + Push phụ', 'strength');

INSERT INTO workout_templates (id, name, type, run_type, target_pace, target_hr_range) VALUES
('44444444-4444-4444-4444-444444444444', 'Easy Run', 'run', 'easy', '8:40–9:20', '125–145'),
('55555555-5555-5555-5555-555555555555', 'Tempo Run', 'run', 'tempo', '7:30–8:10', '150–165'),
('66666666-6666-6666-6666-666666666666', 'Interval Run', 'run', 'interval', '< 7:30', '170–185');

-- =============================================
-- Link exercises → templates (display_order)
-- =============================================

-- Template 1: Ngực + Vai + Tay sau + Core
INSERT INTO template_exercises (template_id, exercise_id, display_order)
SELECT '11111111-1111-1111-1111-111111111111', id, n
FROM (VALUES
  ('Dumbbell Floor Press', 1),
  ('Dumbbell Shoulder Press', 2),
  ('Push Up', 3),
  ('Dumbbell Lateral Raise', 4),
  ('Close Grip Floor Press', 5),
  ('Overhead Tricep Extension', 6),
  ('Dead Bug', 7),
  ('Plank', 8)
) AS t(n, ord)
JOIN exercises ON exercises.name = t.n;

-- Template 2: Lưng + Vai sau + Tay trước + Core
INSERT INTO template_exercises (template_id, exercise_id, display_order)
SELECT '22222222-2222-2222-2222-222222222222', id, n
FROM (VALUES
  ('Bent Over Dumbbell Row', 1),
  ('One Arm Dumbbell Row', 2),
  ('Dumbbell Pullover', 3),
  ('Rear Delt Fly', 4),
  ('Dumbbell Curl', 5),
  ('Hammer Curl', 6),
  ('Russian Twist', 7),
  ('Side Plank', 8)
) AS t(n, ord)
JOIN exercises ON exercises.name = t.n;

-- Template 3: Leg + Push phụ
INSERT INTO template_exercises (template_id, exercise_id, display_order)
SELECT '33333333-3333-3333-3333-333333333333', id, n
FROM (VALUES
  ('Goblet Squat', 1),
  ('Romanian Deadlift', 2),
  ('Reverse Lunge', 3),
  ('Arnold Press', 4),
  ('Lateral Raise', 5),
  ('Push Up', 6),
  ('Dead Bug', 7),
  ('Reverse Crunch', 8)
) AS t(n, ord)
JOIN exercises ON exercises.name = t.n;
