# Sprint 2 Planning

**Status: ✅ APPROVED — Ready for Implementation**
**Version Target: v0.2.0**
**Prerequisites: Sprint 1 (v0.1.0) CLOSED**
**Approved by: Product Owner — 2026-07-09**

---

## Objective

Xây dựng Workout Engine đúng kiến trúc:
- Mỗi Workout Session phải độc lập với Template sau khi tạo
- Người dùng có thể chỉnh sửa danh sách bài tập trong một session cụ thể
- Lịch sử tập luyện không bị thay đổi nếu Template bị sửa sau này

---

## Architecture Decisions (APPROVED)

### AD-01 — Backward Compatibility: Fallback + Progressive Migration

- Session mới tạo → dùng `session_exercises`
- Session cũ chưa có `session_exercises` → fallback sang `template_exercises`
- Migration dần sau, không ép buộc
- **Hard Cutoff: KHÔNG**
- **Không được làm mất lịch sử**

### AD-02 — Snapshot Strategy: Partial Snapshot *(revised từ Full Snapshot)*

`session_exercises` chỉ snapshot dữ liệu thuộc về workout session:
```
session_id
exercise_id             ← FK → exercises
display_order
target_sets
target_reps
notes
created_from_template_id
```

Exercise metadata (name, muscles, image, video, cue, difficulty, equipment) **luôn đọc từ `exercises` table** qua JOIN. Không duplicate.

**Lý do thay đổi từ Full Snapshot:**
Exercise Library sẽ tiếp tục phát triển. Snapshot metadata sẽ tạo coupling không cần thiết và duplicate dữ liệu.

**Risk được xử lý bởi:** ADR-005 — Soft Delete (deferred Sprint 3).
Exercise không bao giờ bị hard delete → JOIN luôn resolve được.

### AD-03 — Import Hash: sha256, không salt

```
import_hash = sha256(date + type + distance_km + duration_seconds)
```

Mục tiêu: Import cùng file nhiều lần không tạo duplicate.
Không dùng salt — collision xảy ra khi 2 buổi chạy có cùng 4 giá trị trên, được coi là cùng 1 buổi.

### AD-04 — Set Management: Không có planned_sets layer

Kiến trúc giữ đơn giản:

```
WorkoutSession
  └── SessionExercises   ← target (snapshot từ template)
        └── WorkoutSets  ← kết quả thực tế
```

- `session_exercises` lưu target sets/reps/cue
- `workout_sets` lưu kết quả thực tế (reps, weight, rpe)
- Thêm set = thêm `WorkoutSet` mới
- Không cần planned_sets layer trung gian

---

## Scope

### S2-01 — Database schema: session_exercises

```sql
CREATE TABLE IF NOT EXISTS session_exercises (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  -- NOT NULL: exercise không bao giờ hard delete (Soft Delete — ADR-005)
  exercise_id              UUID NOT NULL REFERENCES exercises(id),
  -- Workout-specific data only (Partial Snapshot — ADR-004)
  display_order            INT NOT NULL DEFAULT 0,
  target_sets              INT,
  target_reps              TEXT,
  notes                    TEXT,
  -- Tracing
  created_from_template_id UUID,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);
```

**Không snapshot:** exercise_name, muscle_group, technique_cue, image, video, equipment, difficulty.
Exercise metadata luôn JOIN từ `exercises` table.
`exercise_id NOT NULL` vì exercise không bao giờ bị hard delete (ADR-005 — Soft Delete).

### S2-02 — Database schema: import_hash

```sql
ALTER TABLE workout_sessions
ADD COLUMN import_hash TEXT;

CREATE UNIQUE INDEX workout_sessions_import_hash_idx
ON workout_sessions(import_hash)
WHERE import_hash IS NOT NULL;
```

Dùng partial unique index — chỉ enforce uniqueness khi `import_hash IS NOT NULL`.
Sessions tạo qua app (không import) có `import_hash = NULL`, không bị ảnh hưởng.

### S2-03 — Session creation: snapshot template → session_exercises

Khi `POST /api/sessions` với `template_id`:
1. Server tạo `workout_sessions` record
2. Server query `template_exercises JOIN exercises` theo `template_id`
3. Server copy thành `session_exercises` với **Partial Snapshot** (ADR-004): chỉ lưu `exercise_id`, `display_order`, `target_sets`, `target_reps`
4. Client nhận `session.id` → navigate bình thường

### S2-04 — Workout page: đọc session_exercises với fallback

```
Workout page load:
  1. Query session_exercises WHERE session_id = ?
  2. Nếu có kết quả → dùng session_exercises (new path)
  3. Nếu không có → fallback: query template_exercises (old path, AD-01)
```

### S2-05 — Editable workout: add/remove/reorder bài tập

Trong Workout page, thêm controls:
- **Thêm bài**: chọn từ exercise database → insert `session_exercises`
- **Xóa bài**: delete `session_exercises` record (workout_sets của bài đó vẫn còn)
- **Đổi thứ tự**: update `display_order` của các `session_exercises`
- Không ảnh hưởng Template gốc

### S2-06 — Import hash: thay thế application-layer duplicate detection

Thay `(date + name_override)` check bằng:
```
hash = sha256(date + type + distance_km + duration_seconds)
```
Upsert on `import_hash` thay vì INSERT với check trước.

### S2-07 — Nutrition import: ra khỏi Experimental

Validate và test đầy đủ, cập nhật CHANGELOG.

---

## Out of Scope (Sprint 2)

- UI redesign
- Dashboard mới
- AI Coach
- Export improvements
- Running plan / training plan
- Notification / reminder
- Workout history per exercise (cross-session comparison)

---

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Fallback logic phức tạp hơn dự kiến | Medium | Medium | Viết unit test cho cả 2 path trước khi deploy |
| Session cũ có template bị xóa → fallback thất bại | Low | High | Guard: nếu template_id null VÀ không có session_exercises → hiển thị "Session không có dữ liệu bài tập" |
| import_hash partial index edge case | Low | Low | Test bằng cách import cùng file 3 lần |
| Snapshot làm tăng dung lượng DB đáng kể | Low | Low | Supabase free tier có 500MB — với ~1000 sessions/year, ước tính <10MB |

---

## Database Impact Summary

| Thay đổi | Type | Ảnh hưởng data hiện có |
|---|---|---|
| Tạo `session_exercises` table | CREATE TABLE | Không |
| Thêm `import_hash` column | ALTER TABLE ADD COLUMN | Không (nullable) |
| Thêm partial unique index | CREATE INDEX | Không |

**Migration Required: YES** (ALTER TABLE + CREATE TABLE + CREATE INDEX)
**Data at risk: NONE** — tất cả thay đổi là additive

---

## Definition of Done (Sprint 2)

- [ ] `session_exercises` table tồn tại trong Supabase
- [ ] `import_hash` column tồn tại với partial unique index
- [ ] Sessions mới tạo từ template có `session_exercises` đầy đủ
- [ ] Workout page đọc `session_exercises`, fallback sang `template_exercises` nếu không có
- [ ] Sessions cũ không bị break
- [ ] Người dùng có thể thêm/xóa/đổi thứ tự bài trong session
- [ ] Running import dùng `import_hash` — không còn application-layer duplicate check
- [ ] Nutrition import ra khỏi Experimental
- [ ] Sprint Report: tất cả tasks có PASS hoặc documented FAIL

---

## Thứ tự Implementation (Đề xuất)

```
Bước 1: Database migration (S2-01, S2-02) — schema trước
Bước 2: Session creation snapshot (S2-03) — API trước khi UI
Bước 3: Workout page fallback (S2-04) — backward compat
Bước 4: Editable workout (S2-05) — feature mới
Bước 5: Import hash (S2-06) — replace old logic
Bước 6: Nutrition validation (S2-07) — cleanup
```

---

**✅ APPROVED — Chờ lệnh bắt đầu implementation.**
