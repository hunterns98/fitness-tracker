-- ============================================================
-- FITNESS TRACKER — Sprint 2 Migration PATCH
-- Version: v0.2.0-patch1
-- Chạy THÊM file này sau sprint2_migration.sql
-- ============================================================
-- Lý do: Sprint 2 Planning thay đổi từ Full Snapshot → Partial Snapshot (ADR-004)
-- Bảng session_exercises cũ có cột không cần thiết (exercise_name, muscle_group, technique_cue)
-- Vì bảng đang trống (row_count = 0), DROP và CREATE lại là an toàn
-- ============================================================

-- Drop bảng cũ (trống, an toàn)
DROP TABLE IF EXISTS session_exercises;

-- Tạo lại với Partial Snapshot schema (ADR-004)
CREATE TABLE session_exercises (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,

  -- NOT NULL: exercise dùng Soft Delete (ADR-005), không bao giờ hard delete
  exercise_id              UUID NOT NULL REFERENCES exercises(id),

  -- Workout-specific data only (không snapshot metadata)
  display_order            INT NOT NULL DEFAULT 0,
  target_sets              INT,
  target_reps              TEXT,
  notes                    TEXT,

  -- Tracing
  created_from_template_id UUID,

  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Index để query nhanh theo session
CREATE INDEX session_exercises_session_id_idx
  ON session_exercises(session_id, display_order);

-- ── Verify ──────────────────────────────────────────────────
-- Kiểm tra schema đúng (không còn cột exercise_name, technique_cue):
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'session_exercises'
ORDER BY ordinal_position;
