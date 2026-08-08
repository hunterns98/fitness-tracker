# CHANGELOG

All notable changes to Fitness Tracker are documented here.
Format: [Version] — Release Name — Date
### ✅ Sprint 5.3 — Polish: Animation chuyển bài (2026-08-01)

**Scope (Architecture Review đã khóa):** 0 DB, 0 API, chỉ CSS transition.

- **Sửa:** `app/workout/[sessionId]/page.tsx` — vùng nội dung phụ thuộc
  bài tập đang xem (Exercise Strip + Previous Performance + Sets +
  Overload hint) bọc trong `<div key={ex.id} className="space-y-4 fade-in">`
  thay vì `<>...</>`. Khi chuyển bài (`ex.id` đổi), React remount vùng
  này, animation `.fade-in` (đã có sẵn trong `app/globals.css`, dùng
  chung toàn app — không tạo keyframe/class mới) tự chạy.
- **Không đổi:** hành vi nút Previous/Next, progress dot, toàn bộ logic
  nhập set, Exercise Detail Bottom Sheet (Sprint 5.2), Workout Editor.

Đây là milestone cuối của Sprint 5 (Workout Experience).
### 🚧 Sprint 5.2 — Exercise Detail Bottom Sheet (2026-08-01)

**Scope (Architecture Review đã khóa):** 0 migration DB. 1 thay đổi additive.

- **Sửa (additive):** `app/api/session-exercises/route.ts` — GET (cả 2 path:
  session_exercises thật + fallback template_exercises) và POST bổ sung
  field `common_mistakes` vào SELECT + response. Không đổi shape cũ, không
  đổi field nào khác, không đổi contract 409/validation hiện có.
- **Mới:** `components/ExerciseDetailSheet.tsx` — Bottom Sheet hiển thị
  đúng 5 phần theo thứ tự đã khóa: Hero Image → Muscle Highlight →
  Technique → Common Mistakes → Previous Performance. KHÔNG hiển thị
  Difficulty/Equipment/Movement Pattern (khác trang `/exercises/[id]` đầy
  đủ). Previous Performance dạng compact chip (`7kg×15`), không table.
- **Sửa:** `app/workout/[sessionId]/page.tsx` — `ExerciseStrip.onClick` giờ
  mở `ExerciseDetailSheet` (trước là placeholder). Thêm state
  `showDetailSheet`, tự đóng sheet khi đổi bài tập (`exIdx` đổi) để tránh
  hiển thị sai nội dung. `Exercise` type thêm `common_mistakes?`.
- **Kiến trúc:** `heroImageSrc` và `highlightImageSrc` tính riêng biệt
  trong `ExerciseDetailSheet` (2 biến rời, không gộp `ExercisePackage`) —
  đúng quyết định Architecture Review Sprint 5.
- **Không đổi:** schema DB, các API khác, Workout Editor, luồng nhập set.
---
### 🚧 Sprint 5.1 — Exercise Strip + Illustration Package (2026-08-01)

**Scope (Architecture Review đã khóa):** Không migration DB, không API mới.

- **Mới:** `public/muscle-illustrations/*.svg` — 9 illustration tĩnh theo
  `muscle_group` (Ngực, Lưng, Vai, Vai sau, Tay trước, Tay sau, Cẳng tay,
  Chân, Core), đóng gói cùng source code, không qua Storage/upload.
- **Mới:** `lib/muscleIllustrations.ts` — hàm `getMuscleIllustration()`,
  map `muscle_group → đường dẫn illustration`, có fallback an toàn.
- **Sửa:** `app/workout/[sessionId]/page.tsx` — thay "Exercise header" (card
  lớn: tên + mục tiêu + `technique_cue` dạng đoạn văn) bằng **Exercise
  Strip** (component mới, cùng file): thumbnail illustration + tên + mục
  tiêu rút gọn 1 dòng, cao 64-72px, toàn vùng là 1 tap target (trừ nút ✏️
  Sửa bài tập, dùng `stopPropagation`). `technique_cue` không còn hiển thị
  trực tiếp ở Workout Screen — sẽ chuyển vào Exercise Detail Bottom Sheet
  (Sprint 5.2).
- **Không đổi:** Previous Performance (giữ nguyên vị trí/hình thức), toàn
  bộ vùng nhập Set, Progressive overload hint, bottom nav, Workout Editor.
- **Kiến trúc:** dùng 2 biến rời (`heroImageSrc`/nơi gọi), không tạo type
  `ExercisePackage` — quyết định Architecture Review, tránh thiết kế trước
  nhu cầu Sprint 7.

**TODO ghi rõ trong code:** `onClick` của Exercise Strip hiện là placeholder
(không mở gì) — Exercise Detail Bottom Sheet implement ở Sprint 5.2.
## [Unreleased] — Sprint 4: Data Management
### ✅ TD-01 — Running Import: chuyển sang DB-layer duplicate detection (2026-08-01)

**Scope đã khóa (Sprint 4.1):**
1. Running import: bỏ SELECT-trước-rồi-filter, chuyển sang per-row INSERT +
   catch Postgres `23505`, cùng pattern đã dùng cho Workout Import (ADR-008 D4).
2. Giữ nguyên: công thức `import_hash` (byte-identical với 22 session lịch sử
   đã backfill), response shape API (`imported`, `skipped`, `errors`, `message`).
3. Fix UI: `app/data/page.tsx` `importFromFile()` — truyền `result.skipped`
   vào `ImportResult` (trước đây bị bỏ sót, khiến card "Bỏ qua (trùng)" luôn
   hiển thị 0 dù backend trả đúng).

**Files:**
- `app/api/import/route.ts` — nhánh `sheet === 'running'` viết lại hoàn toàn
  phần insert (không đổi `computeImportHash`, không đổi validate).
- `app/data/page.tsx` — 1 dòng trong `importFromFile()`.

**Không đổi:** schema DB (cột + unique index `import_hash` đã tồn tại từ
Sprint 3 Phase 0, dùng chung với Workout), validation logic, các nhánh sheet
khác (`body_metrics`, `sleep_recovery`, `nutrition`).

**Đóng TD-01** (Sprint 2 Retrospective, Technical Debt table).
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
