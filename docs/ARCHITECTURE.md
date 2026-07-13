# Architecture Decision Records (ADR)

Tài liệu ghi lại các quyết định kiến trúc quan trọng của dự án.
Format: [ADR-ID] — Tiêu đề — Ngày — Status

---

## ADR-001 — Single User App (No Multi-tenancy)
**Date:** Sprint 0
**Status:** ACCEPTED

**Context:** App chỉ phục vụ 1 người dùng.

**Decision:** Không implement multi-tenancy, không có bảng `users`. Auth dùng single password + iron-session cookie. Supabase service role key chỉ tồn tại ở server — client không bao giờ cầm key trực tiếp.

**Consequences:** Bỏ qua toàn bộ complexity của multi-user (RLS, billing, role permissions). Nếu sau này mở rộng cho nhiều user sẽ cần refactor lớn.

---

## ADR-002 — Offline-first / Browser-first (No Native App)
**Date:** Sprint 0
**Status:** ACCEPTED

**Decision:** PWA (Progressive Web App) thay vì native iOS/Android. Deploy trên Vercel. Truy cập qua trình duyệt, có thể "Add to Home Screen".

**Consequences:** Không cần App Store. Deploy ngay khi push code. Hạn chế: không có background sync, không có push notification.

---

## ADR-003 — Supabase as Database (No Self-hosted)
**Date:** Sprint 0
**Status:** ACCEPTED

**Decision:** Supabase (managed Postgres) thay vì self-hosted. Free tier đủ dùng cho 1 user.

**Consequences:** Không cần quản lý server, backup tự động. Dependency vào Supabase uptime.

---

## ADR-004 — Workout Session Snapshot: Partial Snapshot
**Date:** Sprint 2 — 2026-07-09
**Status:** ACCEPTED

**Context:**
Sprint 2 ban đầu đề xuất Full Snapshot (copy toàn bộ exercise metadata vào session_exercises). Sau review, Product Owner quyết định Partial Snapshot.

**Decision:**
`session_exercises` chỉ snapshot dữ liệu thuộc về workout session:
```
session_id
exercise_id             ← FK → exercises (không nullable)
display_order
target_sets
target_reps
notes
created_from_template_id
```

Exercise metadata (name, muscles, image, video, cue, difficulty, equipment) **luôn đọc từ `exercises` table** qua JOIN.

**Lý do:**
- Exercise Library sẽ tiếp tục phát triển (ảnh, video, muscle map, AI Coach cue...)
- Không muốn duplicate dữ liệu
- Nếu cue được cải thiện → tất cả session (kể cả cũ) hưởng lợi
- Schema coupling giữa session_exercises và exercise metadata là không cần thiết

**Risk được giải quyết bởi ADR-005:**
Exercise bị xóa → session cũ mất JOIN → giải quyết bằng Soft Delete thay vì hard delete.

**Consequences:**
- Session không hoàn toàn độc lập nếu exercise bị xóa (xem ADR-005)
- JOIN required mỗi lần load workout page — không đáng kể ở scale hiện tại
- Historical accuracy cho cue không được đảm bảo (cue mới override cue cũ)

---

## ADR-005 — Exercise Library: Soft Delete thay vì Hard Delete
**Date:** Sprint 2 — 2026-07-09
**Status:** ACCEPTED — Implementation deferred to Sprint 3

**Context:**
ADR-004 chọn Partial Snapshot, dẫn đến `exercise_id` trong `session_exercises` phải luôn resolve được. Nếu exercise bị hard delete, session cũ mất JOIN.

**Decision:**
Exercise Library dùng Soft Delete. Exercise table bổ sung:
```sql
archived_at TIMESTAMPTZ DEFAULT NULL
```
`archived_at IS NULL` = active, `archived_at IS NOT NULL` = archived.

**Behavior của Archived Exercise:**
- ❌ Không xuất hiện trong Exercise Picker khi tạo Template mới
- ❌ Không xuất hiện trong Exercise Library UI
- ✅ Vẫn tồn tại trong database
- ✅ Session cũ JOIN bình thường
- ✅ AI Coach vẫn đọc được
- ✅ Images, cues, muscle map vẫn giữ nguyên
- ✅ Workout history không bị ảnh hưởng

**Không dùng:**
- Hard DELETE (mất data, session cũ bị break)
- `is_active BOOLEAN` (ít expressive hơn timestamp — không biết archived khi nào)

**Implementation:** Sprint 3
```sql
ALTER TABLE exercises ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX exercises_archived_at_idx ON exercises(archived_at) WHERE archived_at IS NULL;
```

**Filter trong queries:**
```sql
-- Chỉ lấy active exercises
SELECT * FROM exercises WHERE archived_at IS NULL;

-- Session JOIN vẫn lấy cả archived (để hiển thị history)
SELECT se.*, ex.name, ex.technique_cue
FROM session_exercises se
JOIN exercises ex ON ex.id = se.exercise_id;
```

---

## ADR-006 — Import Idempotency: import_hash (SHA256, No Salt)
**Date:** Sprint 2 — 2026-07-09
**Status:** ACCEPTED

**Decision:**
```
import_hash = sha256(date + type + distance_km + duration_seconds)
```

Partial unique index trên `workout_sessions(import_hash) WHERE import_hash IS NOT NULL`.
Sessions tạo qua app có `import_hash = NULL`, không bị ảnh hưởng.

**Lý do không dùng salt:** Hash phục vụ idempotent import. Nếu 2 rows có cùng 4 giá trị trên, được coi là cùng 1 buổi tập.

**Collision edge case:** 2 buổi chạy cùng ngày, cùng distance, cùng duration → hash trùng → chỉ import 1. Chấp nhận được ở use case hiện tại (1 buổi/ngày).

---

## ADR-007 — Set Management: Không có Planned Sets Layer
**Date:** Sprint 2 — 2026-07-09
**Status:** ACCEPTED

**Decision:**
```
WorkoutSession
  └── session_exercises   ← target (snapshot từ template)
        └── workout_sets  ← kết quả thực tế
```

Không có `planned_sets` layer trung gian. Thêm set = thêm `workout_set` mới. Simple và đủ dùng.
