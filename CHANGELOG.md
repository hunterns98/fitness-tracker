# CHANGELOG

All notable changes to Fitness Tracker are documented here.
Format: [Version] — Release Name — Date

---

## [Unreleased] — Sprint 4: Workout Import/Export (ADR-008)

### Bước 3/3 — Workout Import: insert thật + compensating delete
- **File mới** `app/api/import/workout/route.ts`: nhận danh sách session đã
  validate từ client (`{ sessions: [...] }`), insert `workout_sessions`
  (ADR-008 D2: luôn tạo mới, không update session đang tồn tại) kèm
  `import_hash` (D4: `sha256(date+type+name_override+canonical sets)`,
  không salt). Bắt lỗi Postgres `23505` (unique violation) thay vì
  SELECT-trước-rồi-check.
- Insert `session_exercises` rồi `workout_sets` tuần tự sau khi session tạo
  thành công. Nếu 1 trong 2 bước fail → compensating delete: xóa
  `workout_sessions` (CASCADE có sẵn trong schema tự dọn 2 bảng con —
  D6, Application-layer, không dùng PostgreSQL Function/RPC/transaction)
  → đánh dấu session đó `failed` → tiếp tục session_ref kế tiếp, không
  dừng toàn bộ import.
- `app/data/page.tsx`: tách `importFromFile()` (Body/Sleep/Running/Nutrition)
  khỏi luồng Workout hoàn toàn mới `importWorkoutData()`. Thêm
  `groupWorkoutRows()` dùng chung giữa validate (Bước 2) và build payload
  insert (Bước 3), tránh trùng lặp logic gộp theo `session_ref`.
- UI: thay khối "Kiểm tra dữ liệu Workout (chưa import)" bằng khối
  **"Kết quả import Workout"** — 4 trạng thái mỗi session: Đã tạo /
  Trùng (skipped_duplicate) / Lỗi dữ liệu (skipped_invalid) / Thất bại.
- **Fix kỹ thuật (không phải quyết định ADR):** cột "Ghi chú" ở sheet
  "Session Exercises" bị field-map dùng chung (`ghi_chu → note`, số ít)
  normalize sai so với cột thật `notes` (số nhiều) trong bảng
  `session_exercises`. Đã sửa trong `buildValidWorkoutSessions()`: đọc
  đúng key đã normalize (`note`) rồi gán vào field `notes` của payload.
- Không ảnh hưởng `app/api/import/route.ts` và luồng Body/Sleep/Running/
  Nutrition — hành vi giữ nguyên 100%.

### ADR-008 phụ lục D3b — Derive session_exercises cho Legacy Session
- Fact-check runtime (2026-07-28) xác nhận: 5/14 session type=strength
  (36%, tạo trước Sprint 3 Phase 2.5) có `session_exercises = 0` dòng thật
  trong DB — gây toàn bộ Session Ref của các session này báo lỗi "orphan"
  khi validate Workout Import. Xác nhận qua đối chiếu `count(*)` DB thật =
  số dòng file Excel = 69, khớp tuyệt đối — không phải bug export/import,
  mà là giới hạn dữ liệu lịch sử (session dùng fallback `template_exercises`
  theo ADR-001, chưa từng có snapshot thật).
- `app/api/export/route.ts`: khi export sheet "Session Exercises", nếu 1
  session type=strength không có `session_exercises` thật nhưng có
  `template_id`, derive dữ liệu tương đương từ `template_exercises JOIN
  exercises` (cùng logic fallback mà `GET /api/session-exercises` Path 2
  dùng cho hiển thị). Session có `session_exercises` thật giữ nguyên.
- Import: không đổi — session phục hồi từ file sẽ tự động có
  `session_exercises` thật ngay khi tạo (do Import luôn tạo session mới —
  D2), tự chuyển sang mô hình snapshot mới mà không cần migration.
- `docs/ARCHITECTURE.md`: thêm phụ lục D3b vào ADR-008 (không mở lại ADR).

### Bước 2/3 — SHEET_MAP nhận diện Workout, validation session_ref
- Nhận diện 3 sheet "Workout Sessions"/"Session Exercises"/"Workout Sets"
  trong luồng import. Gộp dữ liệu theo `session_ref` (ADR-008 D3), validate
  referential integrity (D1: `exercise_id` phải khớp giữa Session Exercises
  và Workout Sets cùng session_ref; orphan → skip toàn bộ session, báo lỗi
  gộp theo session_ref — đúng UX Design đã chốt).
- Refactor theo review: tách kết quả validate Workout khỏi `ImportResult[]`
  chung (không còn `results.push({ imported: 0, errors })` giả); tách toàn
  bộ logic Workout validation thành hàm riêng, không nằm trong
  `importFromFile()`; bỏ `row: 0` cho lỗi cấp session (dùng `row?: number`,
  UI chỉ hiện "Dòng X" khi có giá trị thật); thêm TODO cho validation sẽ
  bổ sung sau (display_order, target_sets, target_reps, set_number).
- Chưa gọi API insert ở bước này — chỉ validate, hiển thị kết quả kiểm tra.

### Bước 1/3 — Export: session_ref, sheet "Session Exercises", exercise_id
- `app/api/export/route.ts`: thêm query `session_exercises`; sinh
  `session_ref` (số thứ tự, chỉ cho session type='strength') làm khóa nối
  giữa các sheet lúc import (session_id thật chưa tồn tại tại thời điểm
  import — ADR-008 D3).
- Sheet "Workout Sessions": thêm cột `Session Ref` (trống với type=run/other).
- Sheet mới "Session Exercises": target_sets/target_reps/display_order/notes
  theo session_ref.
- Sheet "Workout Sets": đổi `Session ID` (UUID) → `Session Ref` (số); thêm
  cột `Exercise ID` (ADR-008 D1 — identity chính thức để import match,
  không bao giờ theo tên bài).

### Fix — Hoàn tất split exportToExcel (Task 6 dở dang từ Sprint 3, không thuộc ADR-008)
- `app/data/page.tsx`: tách `exportToExcel()` (hàm cũ, gộp chung data+template,
  còn sót lại từ Task 6 dở dang) thành `exportDataToExcel()` (chỉ dữ liệu
  thật) + `exportImportTemplates()` (chỉ sheet mẫu). UI đã gọi 2 tên này từ
  Task 6 nhưng hàm thực tế chưa được tách — gây lỗi build
  "Cannot find name 'exportDataToExcel'". Không đổi hành vi, không đổi nội
  dung sheet — chỉ tách đúng như UI đã kỳ vọng.

### Architecture
- **ADR-008 — Workout Import/Export**: chốt qua Investigation → Architecture
  Review → UX Design → Approval (2026-07-28). Quyết định chính: `exercise_id`
  làm identity (D1); Import luôn tạo session mới, không update (D2);
  `session_ref` nối 3 sheet, sinh tại thời điểm export (D3, + phụ lục D3b);
  `import_hash` full-content trên toàn bộ sets, bắt `23505` thay vì
  SELECT-trước (D4); cho phép import liên kết exercise đã archived (D5);
  Compensating delete ở Application layer, không PostgreSQL Function/RPC/
  transaction (D6). Xem chi tiết đầy đủ ở `docs/ARCHITECTURE.md`.

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
