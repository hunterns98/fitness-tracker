# CHANGELOG

All notable changes to Fitness Tracker are documented here.
Format: [Version] — Release Name — Date

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
