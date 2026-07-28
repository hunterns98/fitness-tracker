# Sprint 3 Phase 3 — Report: Exercise Picker + Workout Editor

**Sprint Status:** ⚠️ PARTIAL PASS
**Sprint Decision:** CLOSED WITH KNOWN LIMITATION
**Release Name:** Exercise Picker + Workout Editor
**Sprint Period:** Sprint 3, Phase 3
**Closed:** 2026-07-28

---

## Mục tiêu Sprint

Cho phép chỉnh sửa danh sách bài tập ngay trong buổi tập đang diễn ra (thêm / xóa / đổi thứ tự), không cần route riêng, không phá vỡ ADR-001/004/005 đã khóa. Cho phép session kháng lực bắt đầu hoàn toàn trống, build bằng Editor.

---

## Manual Test Results — Backend / Data Layer

Đây là các hành vi được server đảm bảo, xác nhận qua quan sát thực tế (không chỉ đọc code).

| # | Test Case | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | Tạo session kháng lực không kèm `template_id` | Session tạo thành công, `session_exercises` rỗng | Đúng như kỳ vọng | ✅ PASS |
| 2 | `POST /api/session-exercises` thêm bài vào session | Server tự tính `display_order`, tự snapshot `target_sets`/`target_reps` | Bài xuất hiện đúng thứ tự cuối danh sách | ✅ PASS |
| 3 | `PATCH .../move` đổi thứ tự | Hoán đổi `display_order` với hàng liền kề, persist đúng | Thứ tự đổi đúng, giữ nguyên sau khi reload | ✅ PASS |
| 4 | `DELETE .../:id` khi bài **chưa** có `workout_sets` | Xóa thành công | Bài biến mất khỏi danh sách | ✅ PASS |
| 5 | `DELETE .../:id` khi bài **đã có** `workout_sets` | Server chặn, trả `409 "Exercise already has logged sets"`, không xóa | Server chặn đúng, dữ liệu không mất | ✅ PASS |
| 6 | Session về 0 bài sau khi xóa hết | Không lỗi, `session_exercises` rỗng | Đúng như kỳ vọng | ✅ PASS |
| 7 | `GET` fallback cho session cũ (trước Sprint 2, chưa có `session_exercises`) | Trả `_source: 'template_fallback'` | Đúng, không phá session cũ | ✅ PASS |

**Kết luận Backend: 7/7 PASS.** Toàn vẹn dữ liệu (Data Integrity) được đảm bảo — không có trường hợp nào mất dữ liệu hoặc lưu sai.

⚠️ **Chưa xác nhận độc lập:** giá trị thật của field `has_logged_sets` trả về từ `GET` (đúng `true`/`false` hay luôn `false`) — xem Known Limitation bên dưới. Việc bảo vệ dữ liệu ở test #5 **không phụ thuộc** vào field này (server tự kiểm tra `workout_sets` lại từ đầu ở bước `DELETE`, độc lập với những gì client đã nhận trước đó).

---

## Manual Test Results — Frontend UX

| # | Test Case | Expected | Actual | Status |
|---|---|---|---|---|
| A | Tạo session trống → empty state → mở Editor | Empty state hiện đúng, Editor mở được | Đúng như kỳ vọng | ✅ PASS |
| B7 | Search "curl" trong Picker | Chỉ hiện bài khớp tên | Đúng | ✅ PASS |
| B8 | Filter theo nhóm cơ "Vai" | Chỉ hiện bài nhóm Vai | Đúng | ✅ PASS |
| B9 | Exercise đã archived không hiện trong Picker | Bị loại khỏi danh sách | Chưa có exercise nào archived để test | ⚪ NOT TESTED |
| C10 | Đổi thứ tự bằng ↑↓ | Thứ tự đổi đúng | Đúng | ✅ PASS |
| C11 | Đang xem 1 bài, reorder bài đó, đóng sheet | Vẫn xem đúng bài đó, không nhảy bài | Đúng | ✅ PASS |
| D1 | Xóa bài chưa có set | Confirm đúng text, xóa thành công | Đúng | ✅ PASS |
| **D2** | **Nút 🗑 disabled khi `has_logged_sets=true`, không mở confirm, không gọi DELETE** | **Nút xám, không bấm được** | **Nút vẫn đỏ, bấm được — nhưng dữ liệu vẫn được bảo vệ đúng (DELETE trả 409)** | **⚠️ Partial Pass — Data Integrity PASS, UX Known Limitation** |
| E | Xóa hết bài, session về 0 | Quay về empty state | Đúng | ✅ PASS |
| F | Đóng sheet giữa chừng khi đang nhập set | Không mất tiến trình đang nhập | Đúng | ✅ PASS |
| G | Mở session cũ (fallback) | Không hiện nút ✏️ | Đúng | ✅ PASS |

**Kết luận Frontend UX: 10/11 PASS, 1 Partial Pass (D2), 1 Not Tested (B9).**

---

## Known Limitation

**KL-01 — Nút xóa (🗑) chưa disable đúng khi bài đã có logged sets**

- **Hiện tượng:** Nút vẫn hiển thị màu đỏ (thay vì xám) và vẫn bấm được, dẫn tới mở confirm + gọi `DELETE` như luồng bình thường, thay vì bị chặn ngay từ UI như đã duyệt ở UX Design.
- **Không ảnh hưởng toàn vẹn dữ liệu:** `DELETE` vẫn trả `409` và không xóa set/bài — đây là lớp bảo vệ ở server, hoạt động độc lập với UI. Người dùng cuối cùng vẫn được bảo vệ, chỉ là trải nghiệm chưa mượt như thiết kế (phải thấy thông báo lỗi thay vì được chặn từ đầu).
- **Nguyên nhân chưa xác định dứt khoát.** Đã loại trừ khả năng sai source code — cả `app/api/session-exercises/route.ts` và `app/workout/[sessionId]/page.tsx` trên GitHub đều đã chứa đúng logic `has_logged_sets` (xác nhận bằng cách tìm chữ trong file thật). Các khả năng còn lại, **chưa được kiểm chứng** vì chưa hard-refresh/kiểm tra Vercel deployment status trong lần test này:
  - (a) Bản deploy trên Vercel chưa build lại đúng commit mới nhất, hoặc
  - (b) Trình duyệt/PWA cache bản JS cũ, hoặc
  - (c) Field `has_logged_sets` bị tính sai ở server (bug thật trong logic, không phải cache) — **chưa loại trừ khả năng này**.
- **Kế hoạch:** Điều tra + fix ở patch kế tiếp. Bước đầu tiên: xác nhận Vercel deployment status + hard refresh/incognito, sau đó nếu vẫn sai thì kiểm tra trực tiếp response JSON của `GET /api/session-exercises` (qua DevTools Network tab) để biết field có đúng giá trị hay không.
- **Mức độ ưu tiên:** Thấp — không rủi ro dữ liệu, chỉ là UX chưa hoàn thiện.

---

## Files Modified

| File | Thay đổi |
|---|---|
| `components/ExercisePicker.tsx` | Mới |
| `app/workout/[sessionId]/page.tsx` | Thêm Workout Editor (add/remove/reorder), empty state, xử lý `has_logged_sets` (chưa hoạt động đúng — KL-01) |
| `app/day/[date]/page.tsx` | Thêm "Bắt đầu trống" |
| `app/api/session-exercises/route.ts` | `GET` thêm field `has_logged_sets` (additive). `POST`/`DELETE`/`move` không đổi. |

---

## Backlog (chuyển sang patch/sprint sau)

| Item | Ghi chú |
|---|---|
| **Fix KL-01** | Điều tra nguyên nhân thật (deploy/cache/logic), sau đó verify lại bằng đúng Manual Test D2 |
| Undo sau khi xóa bài (vài giây) | Đã ghi từ UX Design, chưa implement |
| B9 — test Archive filter trong Picker | Cần có ít nhất 1 exercise archived để test thật |

---

## Migration Required

None — `has_logged_sets` là field tính toán từ query, không phải cột DB mới.
