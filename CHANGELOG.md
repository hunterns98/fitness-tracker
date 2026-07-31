# CHANGELOG

All notable changes to Fitness Tracker are documented here.
Format: [Version] — Release Name — Date

---

## [Unreleased] — Sprint 4: Data Management

### ✅ ADR-008 — Workout Import/Export: IMPLEMENTATION COMPLETE (2026-07-28)

Toàn bộ Manual Test Checklist (Bước 1, 2, 3) đã PASS, bao gồm regression cho
Body/Sleep/Running/Nutrition. Quy trình đầy đủ: Investigation → Root Cause
Analysis (KL-01, tách riêng) → Architecture Review (D1–D6 + phụ lục D3b) →
UX Design → Approval → Implementation (3 bước) → Manual Test → CHANGELOG.
Không có bước nào bị bỏ qua.

**Kết quả xác nhận qua test thật (không phải suy đoán):**
- Import `fitness-data.xlsx` → tạo đúng 14 session mới (khớp 14 Session Ref).
- Import lại cùng file lần 2 → `Đã tạo: 0`, `Trùng: 14` — `import_hash` +
  bắt lỗi Postgres `23505` chặn duplicate chính xác, không cần SELECT-trước.
- Sửa 1 giá trị trong file → chỉ đúng session đó được tạo mới (hash đổi),
  các session khác vẫn bị chặn trùng — đúng hành vi D2+D4 đã thiết kế.
- Summary page hiển thị đúng target snapshot (`session_exercises`) và
  workout sets sau khi import.
- 5 session "legacy" (từng dùng fallback `template_exercises`, ADR-001) sau
  khi import lại đã có `session_exercises` THẬT trong DB — tự chuyển sang
  mô hình snapshot mới, không cần migration (đúng phụ lục D3b).
- Compensating delete (Application-layer, CASCADE có sẵn trong schema) hoạt
  động đúng — không để lại session mồ côi khi 1 bước insert thất bại.

**Quyết định kiến trúc đã khóa (ADR-008, xem đầy đủ ở `docs/ARCHITECTURE.md`):**
D1 (exercise_id làm identity) · D2 (Import luôn tạo session mới) · D3 + D3b
(session_ref nối 3 sheet, derive cho legacy session) · D4 (import_hash
full-content trên sets, bắt 23505) · D5 (cho phép import exercise đã
archived) · D6 (Compensating delete Application-layer, không PostgreSQL
Function/RPC/transaction).

### Bước 3/3 — Workout Import: insert thật + compensating delete
- **File mới** `app/api/import/workout/route.ts`: insert `workout_sessions`
  (D2, D4) → bắt `23505` → insert `session_exercises` + `workout_sets` →
  compensating delete qua CASCADE nếu fail (D6) → tiếp tục session_ref kế tiếp.
- `app/data/page.tsx`: `importWorkoutData()` mới, tách hoàn toàn khỏi
  `importFromFile()`. Thêm `groupWorkoutRows()` dùng chung giữa validate và
  build payload insert. UI: khối "Kết quả import Workout" (4 trạng thái:
  Đã tạo / Trùng / Lỗi dữ liệu / Thất bại).
- Fix kỹ thuật: cột "Ghi chú" ở sheet Session Exercises normalize thành
  `note` (field-map dùng chung) nhưng schema DB dùng `notes` — đã map đúng
  lại trong `buildValidWorkoutSessions()`.
- Không ảnh hưởng `app/api/import/route.ts` và luồng Body/Sleep/Running/
  Nutrition — regression test xác nhận PASS.

### ADR-008 phụ lục D3b — Derive session_exercises cho Legacy Session
- Fact-check runtime xác nhận 5/14 session type=strength (36%, tạo trước
  Sprint 3 Phase 2.5) có `session_exercises = 0` dòng thật — không phải bug,
  là giới hạn dữ liệu lịch sử (fallback ADR-001 chưa từng ghi snapshot).
- `app/api/export/route.ts`: derive session_exercises từ `template_exercises
  JOIN exercises` cho các session này khi export (cùng logic fallback của
  `GET /api/session-exercises` Path 2).

### Bước 2/3 — SHEET_MAP nhận diện Workout, validation session_ref
- Nhận diện 3 sheet Workout, gộp theo `session_ref`, validate referential
  integrity (D1), orphan → skip toàn bộ session, báo lỗi gộp theo session.
- Refactor: tách kết quả validate khỏi `ImportResult[]` chung; tách logic
  thành hàm riêng; bỏ `row: 0` cho lỗi cấp session; thêm TODO cho validation
  giá trị field (chưa cấp thiết cho Bước 3).

### Bước 1/3 — Export: session_ref, sheet "Session Exercises", exercise_id
- Thêm `session_ref`, sheet mới "Session Exercises", cột `Exercise ID` ở
  Workout Sets (D1, D3).

### Fix — Hoàn tất split exportToExcel (Task 6 dở dang từ Sprint 3)
- Tách `exportToExcel()` cũ thành `exportDataToExcel()` + `exportImportTemplates()`
  — sửa lỗi build do UI đã gọi 2 tên mới nhưng hàm chưa được tách.

### Còn lại trong Sprint 4 (chưa làm — xem mục "Bước tiếp theo" bên dưới)
- Running: chuyển duplicate detection sang `import_hash` (TD-01, ADR-006 —
  cột đã tồn tại production nhưng `app/api/import/route.ts` vẫn dùng
  `(date + name_override)` ở application layer).
- Nutrition: đưa ra khỏi trạng thái Experimental — validate và test đầy đủ
  (S2-07, Sprint 2 Planning).

---

## [v0.1.0] — Sprint 1 Stable — 2026-07-09

### Fixed
- **[P0] Running Import**: Sheet tên "Running" trong Excel không được nhận dạng (SHEET_MAP chỉ có "Template - Running"). Đã thêm "Running" vào SHEET_MAP.
- **[P1] UUID undefined**: Tạo Easy Run session thất bại do field `run_type_custom` không tồn tại trong schema `workout_sessions`. UUID trả về là `undefined`, dẫn đến URL `/workout/undefined/run` và lỗi `invalid input syntax for type uuid`. Đã xóa field không hợp lệ, thêm defensive guard trước khi navigate.
- **[P2] Rest Day**: Nút Nghỉ ngơi biến mất sau khi refactor Homepage. Đã khôi phục trong Day View page với panel confirm riêng.

### Added
- **Duplicate detection cho Running import**: Trước khi insert, API kiểm tra `(date, name_override)` trong database. Rows trùng được skip thay vì tạo duplicate. UI hiển thị số dòng "Bỏ qua (trùng)".
- **Import UI cải thiện**: Kết quả import hiển thị 3 cột: Đã import / Bỏ qua (trùng) / Lỗi.
- **Defensive programming cho createSession**: Error state hiển thị rõ ràng nếu API thất bại. Không navigate nếu `session.id` không hợp lệ.

### Experimental (NOT TESTED)
- Nutrition import support trong `api/import/route.ts` — chưa được validate, không announce là feature hoàn thành.

### Known Limitations
- Duplicate detection dùng `(date + name_override)` ở application layer — sẽ được thay bằng `import_hash` DB constraint ở v0.2.0.
- Workout Template bị lock (không thể thêm/xóa/đổi thứ tự bài) — sẽ được giải quyết bằng `session_exercises` ở v0.2.0.

### Migration Required
None.

---

## [v0.0.x] — Pre-Sprint (Development Phase)

### Phase 1 — MVP
- Workout Tracker (kháng lực + chạy bộ)
- Exercise Database với technique cues
- Progressive Overload tracking (badge "Tăng tạ →")
- Auth: single password với iron-session

### Phase 2 — Dashboard & Data
- Calendar view tháng với workout icons
- Day View: log bất kỳ ngày nào, thêm session cho ngày bất kỳ
- Dashboard: 5 tab (Cơ thể / Sức mạnh / Chạy bộ / Dinh dưỡng / Phục hồi)
- Time filter: 1 tuần / 1 tháng / 3 tháng / Tất cả
- Bodyweight chart: hiển thị reps thay vì weight=0
- Running type dropdown: 9 loại (Recovery / Easy / Long / Tempo / Interval / Threshold / Race / Trail / Other)
- Other Workout type (Jump Rope, Swimming, Cycling...)
- Strength: nhập thời gian thủ công khi hoàn thành
- Light theme toàn app
- Workout streak counter
- Import/Export Excel (Body Metrics, Sleep, Running, Nutrition)
- Ghi chép hàng ngày: Cơ thể / Giấc ngủ / Dinh dưỡng
- AI Coach page (cần Anthropic API key)

### Phase 3 — Data
- Import lịch sử 11/5–28/6: Body Metrics, Sleep, Running (20 buổi), Dinh dưỡng (38 ngày)
