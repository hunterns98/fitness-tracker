# CHANGELOG

All notable changes to Fitness Tracker are documented here.
Format: [Version] — Release Name — Date
## [Unreleased] — Sprint 4: Workout Import/Export (In Progress)

### Step 1/N — Export: session_ref, sheet "Session Exercises", exercise_id (ADR-008)
- `app/api/export/route.ts`: thêm query `session_exercises`; sinh `session_ref` (số thứ tự,
  chỉ cho session type='strength') để làm khóa nối giữa các sheet lúc import.
- Sheet "Workout Sessions": thêm cột `Session Ref` (trống với type=run/other).
- Sheet mới "Session Exercises": target_sets/target_reps/display_order/notes theo session_ref.
- Sheet "Workout Sets": đổi `Session ID` (UUID) → `Session Ref` (số); thêm cột `Exercise ID`.
- **Import: CHƯA có gì thay đổi** — 3 sheet trên chưa được nhận diện bởi `SHEET_MAP`,
  import file sẽ tự động bỏ qua chúng (hành vi đã có sẵn, không phải bug).
[Unreleased — Sprint 3 Phase 3] — Exercise Picker + Workout Editor
Added
`components/ExercisePicker.tsx` (mới): component UI chọn bài tập, search + filter hoàn toàn client-side (`allowArchived`, `allowSearch`, `allowFilter`, `onSelect`). Không chứa business logic.
Workout Editor (nhúng trong `app/workout/[sessionId]/page.tsx`): thêm/xóa/đổi thứ tự bài tập ngay trong buổi đang tập, qua bottom sheet, không cần route riêng.
Entry point: icon ✏️ cạnh chỉ số "X/Y" trong card bài tập
Reorder bằng nút ↑ ↓ (không drag-and-drop), dùng `PATCH /api/session-exercises/:id/move`
Thêm bài dùng `POST /api/session-exercises` (server tự tính display_order + snapshot target_sets/target_reps theo ADR-004)
Remove dùng `DELETE /api/session-exercises/:id`, có confirm: "Xóa {tên} khỏi buổi tập này? Các set đã ghi sẽ vẫn được giữ lại."
Session kháng lực rỗng: `app/day/[date]/page.tsx` có nút "Bắt đầu trống, tự chọn bài tập →" — tạo session `strength` không kèm `template_id`. Workout page hiển thị empty state khi 0 bài.
Behavior note (phát hiện khi đối chiếu API thật, không phải bug)
`DELETE /api/session-exercises/:id` chặn xóa (409) nếu bài tập đã có `workout_sets` được log trong session. Khi gặp trường hợp này, Workout Editor hiện `alert()` giải thích thay vì xóa. Đây là guard đã có sẵn trong API (bảo toàn lịch sử tập luyện), không phải thay đổi mới.
Session dùng `template_fallback` (session cũ trước Sprint 2, chưa có `session_exercises` thật) không hiện nút ✏️ Sửa bài tập — quyết định giữ tương thích ngược theo ADR-001.
Không đổi
Schema DB (`exercises`, `session_exercises`)
Archive Guard (vẫn chỉ chặn theo `template_exercises`)
Backlog (không nằm trong sprint này)
Undo trong vài giây sau khi xóa bài khỏi session
Status
⚠️ PARTIAL PASS — Manual Test hoàn tất (xem docs/SPRINT_3_PHASE_3_REPORT.md).
Backend / Data Integrity: 7/7 PASS.
Frontend UX: 10/11 PASS, 1 Partial Pass, 1 Not Tested.

Known Limitation
Nút xóa (🗑) chưa disable đúng khi bài đã có logged sets — nút vẫn đỏ và bấm được,
nhưng server vẫn chặn đúng bằng HTTP 409, dữ liệu không bị mất. Nguyên nhân chưa xác
định dứt khoát (nghi cache/deploy hoặc field has_logged_sets tính sai ở server — cần
điều tra thêm). Không ảnh hưởng toàn vẹn dữ liệu. Sẽ xử lý ở patch kế tiếp.
```
Không cần sửa gì khác trong khối này — phần Added / Behavior note / Không đổi / Backlog giữ nguyên.
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
