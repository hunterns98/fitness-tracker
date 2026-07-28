# Implementation — Exercise Picker + Workout Editor

**Phase:** Implementation (Step 5/6) — **✅ READY FOR MANUAL TEST**
**Đối chiếu:** Đã đọc code thật của 3 API `session-exercises` (POST / DELETE / move) + xác nhận field `archived_at`. Không còn suy đoán.

---

## 1. Files

| File | Loại | Mô tả |
|---|---|---|
| `components/ExercisePicker.tsx` | Mới | Không đổi so với bản trước — `archived_at` đã đúng ngay từ đầu |
| `app/workout/[sessionId]/page.tsx` | Sửa | Đã cập nhật để khớp đúng contract 3 API thật |
| `app/day/[date]/page.tsx` | Sửa | Không đổi so với bản trước |

---

## 2. Đối chiếu API thật vs Implementation — kết quả

### 2.1 `POST /api/session-exercises` — có 1 điểm khác, đã sửa
**Thật:** chỉ nhận `{ session_id, exercise_id }`. Server tự tính `display_order` (MAX+1) và tự snapshot `target_sets`/`target_reps` từ `exercises` (đúng ADR-004). Trả `409` nếu exercise đã archived, hoặc đã có trong session.

**Đã sửa:** `addExerciseToSession()` giờ chỉ gửi `{ session_id, exercise_id }`. Thêm xử lý lỗi cho 2 mã 409 (archived / đã tồn tại) — hiển thị `editorError` trong sheet thay vì âm thầm bỏ qua.

### 2.2 `DELETE /api/session-exercises/:id` — có 1 điểm khác **quan trọng**, đã sửa
**Thật:** server **chặn xóa hoàn toàn** (409 `"Exercise already has logged sets"`) nếu bài tập đã có `workout_sets` được log trong session này. Đây **không phải** "xóa nhưng giữ lại set" như giả định ban đầu khi viết confirm text — mà là "không cho xóa luôn".

**Đã sửa:** `removeExerciseFromSession()` bắt riêng lỗi `409` này → hiện `alert()` giải thích rõ: *"Không thể xóa vì buổi tập này đã ghi set cho bài này. Set đã ghi được giữ nguyên — bài tập vẫn ở trong danh sách."*

**Về confirm text đã duyệt** (*"Xóa {tên} khỏi buổi tập này? Các set đã ghi sẽ vẫn được giữ lại."*): giữ nguyên nội dung này vì với đa số trường hợp (bài chưa log set) confirm vẫn đúng — hành động xóa thành công bình thường. Chỉ khi bài đã có set thì API chặn và người dùng nhận thêm 1 thông báo giải thích tại sao. Không cần đổi câu confirm gốc, chỉ cần xử lý case lỗi phía sau nó.

→ **Cần bạn xác nhận cách xử lý này (alert bổ sung khi bị chặn) là chấp nhận được**, vì đây là hành vi khác với kỳ vọng ban đầu lúc UX Design duyệt câu confirm.

### 2.3 `PATCH /api/session-exercises/:id/move` — khớp đúng, không cần sửa logic
Body `{ direction: 'up' | 'down' }` khớp 100%. API trả về full list đã cập nhật, nhưng code vẫn dùng `reloadExercises()` (1 GET riêng) thay vì dùng thẳng response — giữ đơn giản, không tạo 2 đường mapping dữ liệu song song. Không ảnh hưởng UX, chỉ là 1 network call thừa, chấp nhận được ở quy mô dữ liệu hiện tại (~21-50 exercises).

### 2.4 `archived_at` — khớp đúng
Không cần sửa `ExercisePicker.tsx`.

### 2.5 Cải thiện thêm khi đối chiếu: theo dõi bài đang xem theo identity
Khi đọc kỹ response của GET/POST/move, nhận ra `exIdx` (theo vị trí) sẽ bị sai nếu reorder hoặc thêm/xóa bài không phải bài cuối. Đã sửa `reloadExercises()` để theo dõi bài đang xem theo `exercise_id` (identity) thay vì theo index — reorder sẽ không làm nhảy sang bài khác ngoài ý muốn. Đây là sửa lỗi phát sinh khi đối chiếu, không đổi UX đã duyệt.

---

## 3. Đối chiếu với UX Design đã duyệt — không đổi

| Quyết định | Trạng thái |
|---|---|
| 1. Entry point ✏️ cạnh X/Y | ✅ không đổi |
| 2. Không toast khi thêm | ✅ không đổi |
| 3. Session 0 exercise + empty state | ✅ không đổi |
| 4. Confirm text khi xóa | ✅ giữ nguyên văn đã duyệt (xem 2.2 về case bị chặn) |
| 5. Cho xóa bài cuối cùng | ✅ không đổi — lưu ý: guard 409 ở 2.2 áp dụng bất kể là bài cuối hay không, dựa trên "đã có set" chứ không dựa trên vị trí |
| Backlog: Undo | ⏸ không implement, giữ nguyên ghi nhận |

---

## 4. Quyết định implementation giữ nguyên từ bản trước

Session dùng `template_fallback` (session cũ trước Sprint 2): vẫn **ẩn nút ✏️** — không đổi, không liên quan đến 3 API vừa đối chiếu.

---

## 5. Manual Test Checklist (đã cập nhật test case #7 cho khớp hành vi thật)

| # | Test case | Kết quả mong đợi |
|---|---|---|
| 1 | Tạo buổi kháng lực từ template như cũ | Không đổi hành vi |
| 2 | Tạo buổi kháng lực bằng "Bắt đầu trống" | Vào `/workout/:id`, empty state |
| 3 | Empty state → "✏️ Sửa bài tập" → "+ Thêm bài tập" → chọn 1 bài | Bài xuất hiện cuối list, quay lại Workout page |
| 4 | Thêm bài thứ 2, thứ 3 | Đúng thứ tự, append cuối |
| 5 | Nhấn ↑ / ↓ đổi thứ tự | Thứ tự đúng; nếu đang xem bài đó, vẫn xem đúng bài đó sau khi đổi (không nhảy bài) |
| 6 | Xóa 1 bài **chưa có set nào** | Confirm đúng text, xóa thành công, bài biến mất |
| 7 | Xóa 1 bài **đã lưu ít nhất 1 set** | Confirm hiện, nhưng API trả 409 → `alert()` giải thích, bài **KHÔNG** bị xóa, vẫn nằm trong list |
| 8 | Xóa hết các bài chưa có set, đến khi session rỗng | Quay về empty state |
| 9 | Thêm 1 bài đã có sẵn trong session (trường hợp hiếm, đã bị `excludeIds` chặn ở Picker) | Không thể xảy ra qua UI bình thường — bỏ qua trừ khi cố tình test race condition |
| 10 | Search "curl" trong picker | Chỉ hiện Dumbbell Curl, Hammer Curl |
| 11 | Filter theo nhóm cơ "Vai" | Chỉ hiện bài nhóm Vai |
| 12 | Exercise đã archived | Không xuất hiện trong picker |
| 13 | Mở session cũ (fallback, trước Sprint 2) | Không thấy nút ✏️ |
| 14 | Đóng sheet giữa chừng (tap ra ngoài) | Không mất tiến trình set đang nhập |

---

## 6. Việc còn lại trước khi coi Sprint này CLOSED

1. Bạn xác nhận cách xử lý 409 khi xóa bài đã có set (mục 2.2) — có chấp nhận `alert()` giải thích, hay muốn UI khác (vd. disable nút 🗑 ngay từ đầu cho bài đã có set, thay vì để user confirm rồi mới báo lỗi)?
2. Bạn chạy Manual Test Checklist (mục 5) trên môi trường thật.
3. Sau khi có kết quả PASS/FAIL, tôi viết Sprint Report chính thức + cập nhật `CHANGELOG.md`.

---

## 7. Cập nhật — disable nút xóa cho bài đã có logged sets (thay vì confirm-rồi-báo-lỗi)

**Quyết định của bạn:** disable nút 🗑 ngay từ đầu nếu `has_logged_sets = true`, không mở confirm, không gọi DELETE, hiện tooltip giải thích. Server vẫn giữ nguyên 409.

**Kết quả kiểm tra:** `GET /api/session-exercises` **chưa có** `has_logged_sets` — đã đề xuất + áp dụng thay đổi additive nhỏ nhất (xem `API_CHANGE_PROPOSAL_has_logged_sets.md`):
- Thêm 1 query `workout_sets` theo `session_id` trong `GET`, đánh dấu `has_logged_sets` cho từng bài
- Không đổi `POST` / `DELETE` / `move` (DELETE vẫn giữ nguyên 409 làm chốt chặn cuối — dùng cho defense-in-depth nếu có race condition)
- Không đổi schema DB

**File đã sửa:**
- `app/api/session-exercises/route.ts` — thêm `has_logged_sets` trong response của `GET` (cả 2 path) và `POST` (luôn `false` vì vừa thêm)
- `app/workout/[sessionId]/page.tsx`:
  - `Exercise` type thêm `has_logged_sets?: boolean`
  - Nút 🗑 trong Edit list: `disabled` khi `e.has_logged_sets`, màu xám (`var(--text-3)`, opacity 0.5), `title` = *"Không thể xóa vì bài tập đã có dữ liệu đã ghi."*
  - `removeExerciseFromSession()` nhận thêm tham số `hasLoggedSets`, early-return nếu `true` (phòng hờ) — confirm/DELETE/alert 409 cũ vẫn giữ nguyên làm lớp bảo vệ thứ 2

**Manual Test Checklist — cập nhật case #7:**

| # | Test case | Kết quả mong đợi |
|---|---|---|
| 7 | Bài đã có ít nhất 1 set đã lưu | Nút 🗑 hiện màu xám, không bấm được; hover/tap giữ hiện tooltip "Không thể xóa vì bài tập đã có dữ liệu đã ghi."; không có confirm dialog nào xuất hiện |
| 7b | (race condition, khó test tay) 2 tab cùng lúc — tab A vừa log set cho bài X, tab B chưa reload nên nút 🗑 của bài X vẫn chưa xám | Nếu tab B cố xóa: server trả 409, `alert()` cũ hiện ra như lớp bảo vệ thứ 2 |

**Trạng thái:** ✅ READY FOR MANUAL TEST (đã bao gồm thay đổi này)
