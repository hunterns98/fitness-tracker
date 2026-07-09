# Sprint 2 Planning

**Status: DRAFT — Pending Product Owner Review**
**Version Target: v0.2.0**
**Prerequisites: Sprint 1 (v0.1.0) merged và stable**

---

## Objective

Xây dựng Workout Engine đúng kiến trúc:
- Mỗi Workout Session phải độc lập với Template sau khi tạo
- Người dùng có thể chỉnh sửa danh sách bài tập trong một session cụ thể
- Lịch sử tập luyện không bị thay đổi nếu Template bị sửa

---

## Scope (Đề xuất)

### S2-01 — session_exercises table
Thêm bảng mới `session_exercises` để snapshot template tại thời điểm tạo session.

Các field đề xuất:
- `id` UUID PK
- `session_id` FK → `workout_sessions`
- `exercise_id` FK → `exercises`
- `display_order` INT
- `target_sets_override` INT nullable
- `target_reps_override` TEXT nullable
- `created_from_template_id` UUID nullable (tracing)

### S2-02 — Session creation snapshot
Khi tạo session từ template:
→ Server copy `template_exercises` → `session_exercises`
→ Workout page đọc `session_exercises` thay vì `template_exercises`

### S2-03 — Editable workout session
Trong Workout page, cho phép:
- Thêm bài tập vào session (không ảnh hưởng template)
- Xóa bài tập khỏi session
- Đổi thứ tự bài tập
- Override target sets/reps cho session cụ thể

### S2-04 — import_hash cho duplicate detection
Thêm column `import_hash TEXT UNIQUE` vào `workout_sessions`.
Hash = `sha256(date + type + distance_km + duration_seconds)`.
Thay thế duplicate detection ở application layer (TD-01, TD-02).

### S2-05 — Nutrition import validation (từ TD-02)
Validate và test đầy đủ nutrition import.
Đưa ra khỏi trạng thái Experimental.

---

## Out of Scope (Sprint 2)

- UI redesign
- Dashboard mới
- AI Coach (cần Anthropic API key)
- Export improvements
- Running plan / training plan
- Notification / reminder

---

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Migration backfill session_exercises cho sessions cũ | High | High | Fallback: nếu session không có session_exercises → đọc từ template (backward compat) |
| `import_hash` column thêm vào bảng có data | Medium | Medium | ALTER TABLE không xóa data; cột nullable trước, unique sau khi backfill |
| Editable workout thay đổi UX flow quen thuộc | Low | Medium | Feature flag hoặc phát triển song song |

---

## Database Impact

### Thay đổi cần thiết

```sql
-- S2-01
CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  display_order INT NOT NULL DEFAULT 0,
  target_sets_override INT,
  target_reps_override TEXT,
  created_from_template_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- S2-04
ALTER TABLE workout_sessions
ADD COLUMN import_hash TEXT;
-- Sau khi backfill:
ALTER TABLE workout_sessions
ADD CONSTRAINT workout_sessions_import_hash_unique UNIQUE (import_hash);
```

### Migration cần thiết
- Backfill `session_exercises` cho sessions cũ (dùng `template_id` hiện có)
- Backfill `import_hash` cho running sessions đã import

---

## Architecture Questions — Cần Review Trước Khi Code

**Q1: Backward compatibility**
Sessions cũ (pre-Sprint 2) không có `session_exercises`. Workout page sẽ xử lý thế nào?
- Option A: Fallback — nếu không có `session_exercises` thì đọc từ `template_exercises`
- Option B: Migration script — backfill tất cả sessions cũ ngay khi deploy
- Option C: Hard cutoff — chỉ apply cho sessions mới, sessions cũ hiển thị "legacy"

**Q2: Snapshot strategy**
Khi snapshot template → session_exercises, nên copy những gì?
- Chỉ exercise list và order (tối giản)
- Cả target_sets và target_reps (đủ để override)
- Cả technique_cue (snapshot đầy đủ)

**Q3: Import hash collision**
Nếu 2 buổi chạy cùng ngày, cùng distance, cùng duration → hash collision → không insert được.
Cần thêm salt (vd: index thứ tự trong file) vào hash không?

**Q4: Editable workout — set management**
Hiện tại số set được khởi tạo từ `exercise.target_sets`. Nếu người dùng muốn thêm set thứ 5:
- Thêm vào `workout_sets` trực tiếp (hiện tại đang làm)
- Hay cần thêm `planned_sets` trước, rồi mới log actual?

---

## Definition of Done (Sprint 2)

- [ ] `session_exercises` table tồn tại trong database
- [ ] Sessions mới tạo từ template đều có `session_exercises` tương ứng
- [ ] Sessions cũ không bị break (backward compat hoặc migration)
- [ ] Workout page đọc từ `session_exercises` thay vì `template_exercises`
- [ ] Người dùng có thể thêm/xóa bài tập trong session mà không ảnh hưởng template
- [ ] `import_hash` column tồn tại và enforce uniqueness ở DB layer
- [ ] Nutrition import ra khỏi Experimental
- [ ] Sprint Report: tất cả tasks có PASS hoặc documented FAIL với reason

---

**⏸ WAITING: Product Owner review và approve trước khi bắt đầu implementation.**
