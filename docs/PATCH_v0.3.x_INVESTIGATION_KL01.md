# Patch v0.3.x — Investigation: KL-01

**Phase:** Investigation (Step 1/7) — Không code, không sửa, không refactor
**Bug:** Nút 🗑 vẫn bấm được cho bài đã có logged sets, dù đã implement `has_logged_sets` để disable

---

## Current State

- Sprint 3 Phase 3 đã CLOSED WITH KNOWN LIMITATION.
- Server (`DELETE /api/session-exercises/:id`) chặn đúng bằng `409` khi bài có `workout_sets` — xác nhận qua Manual Test thật (D2), độc lập với field `has_logged_sets`. Toàn vẹn dữ liệu không bị ảnh hưởng bởi bug này.
- Bug chỉ nằm ở lớp UI: nút xóa lẽ ra phải bị disable trước khi user bấm, nhưng thực tế vẫn cho bấm.

---

## Evidence

Những gì đã xác minh được (không suy đoán):

| # | Việc đã kiểm tra | Cách kiểm tra | Kết quả |
|---|---|---|---|
| E1 | `app/api/session-exercises/route.ts` trên GitHub có chứa logic `has_logged_sets` | User tìm chữ "has_logged_sets" trực tiếp trong file trên GitHub | Xuất hiện ở dòng 16, 76, 107, 213 — khớp đúng vị trí với bản tham chiếu (comment, path 1 result mapping, fallback path, POST result) |
| E2 | `app/workout/[sessionId]/page.tsx` trên GitHub có chứa logic disable dựa trên `has_logged_sets` | User tìm chữ tương tự trên GitHub | Xuất hiện "vài dòng" — khớp với 4 vị trí trong bản tham chiếu (type định nghĩa, comment, `disabled=`, `title=`, `style=`) |
| E3 | Hành vi thực tế khi test D2 | Test tay trên app đã deploy | Nút 🗑 hiển thị màu **đỏ** (không xám), **bấm được**; sau khi bấm (qua confirm, rồi gọi DELETE) server trả lỗi và hiện thông báo — khớp với hành vi của **phiên bản UI cũ** (trước khi thêm logic disable), không khớp với phiên bản mới |
| E4 | Vercel deployment status tại thời điểm test | **Chưa kiểm tra** — người dùng chưa mở tab Deployments trên Vercel để xác nhận commit/status "Ready" | Không có dữ liệu |
| E5 | Browser cache / hard-refresh / incognito | **Chưa kiểm tra** — người dùng chọn dừng test sau khi xác nhận dữ liệu an toàn, không thực hiện hard-refresh hay incognito trước khi kết luận | Không có dữ liệu |
| E6 | Response JSON thật của `GET /api/session-exercises` cho bài đã log set | **Chưa kiểm tra** — chưa ai mở DevTools Network tab để xem giá trị `has_logged_sets` thật trả về là `true` hay `false` cho case cụ thể đó | Không có dữ liệu |

---

## Possible Causes

### A. Deployment
Vercel có thể build từ commit cũ (trước khi thêm `has_logged_sets`), hoặc build mới chưa kịp hoàn tất tại thời điểm test.
**Trạng thái bằng chứng:** Chưa kiểm tra (E4). Không thể xác nhận hay loại trừ.

### B. Browser / Client cache
Trình duyệt (hoặc PWA nếu đã "Add to Home Screen") có thể giữ bundle JS cũ dù server đã deploy đúng bản mới.
**Trạng thái bằng chứng:** Chưa kiểm tra (E5). Không thể xác nhận hay loại trừ.
**Ghi chú kỹ thuật:** Code hiện tại không có Service Worker riêng (không thấy cấu hình PWA/next-pwa trong `package.json` hay code đã xem) — nên khả năng cache ở tầng Service Worker thấp, nhưng cache HTTP thông thường của trình duyệt/CDN vẫn có thể xảy ra.

### C. Frontend logic
Source code trên GitHub đã đúng (E1, E2). Nếu Deployment và Cache đều bị loại trừ (cần kiểm tra thêm), khả năng còn lại ở tầng frontend là rất thấp — vì logic disable (`disabled={... || e.has_logged_sets}`) đơn giản, không có nhánh rẽ ẩn nào khác có thể gây sai lệch đã được phát hiện qua đọc lại code.
**Trạng thái bằng chứng:** Source code đã được xem lại, không phát hiện lỗi logic ở tầng này. Nhưng chưa có bằng chứng runtime (E6) để xác nhận `exercises` state trong React thực sự nhận đúng `has_logged_sets=true` từ API.

### D. Backend — lỗi tính toán `has_logged_sets` (phát hiện qua đọc lại code, chưa xác nhận runtime)
Đoạn code thêm mới trong `GET`:
```ts
const { data: loggedSets } = await supabase
  .from('workout_sets')
  .select('exercise_id')
  .eq('session_id', sessionId)
const loggedExerciseIds = new Set((loggedSets ?? []).map(r => r.exercise_id))
```
Dòng này **không bắt lỗi** (`error` bị bỏ qua, không destructure). Nếu query này thất bại vì bất kỳ lý do gì (permission, tên cột, timeout, v.v.), `loggedSets` sẽ là `undefined`/`null`, `loggedExerciseIds` sẽ là `Set` rỗng, và **mọi bài đều nhận `has_logged_sets: false`** — im lặng, không có log lỗi nào xuất hiện. Đây là một lỗ hổng thiết kế có thể gây đúng triệu chứng quan sát được (luôn `false` bất kể thực tế).
**Trạng thái bằng chứng:** Đây là phát hiện từ đọc lại code (static analysis), **chưa có bằng chứng runtime** xác nhận query này thực sự lỗi. Cần E6 để xác nhận.

---

## Ruled Out

- **Source code trên GitHub bị thiếu logic `has_logged_sets`** — RULED OUT. Cả 2 file (`route.ts`, `page.tsx`) đã xác nhận có logic ở đúng vị trí tương ứng bản tham chiếu (E1, E2).
- **Lỗi ảnh hưởng toàn vẹn dữ liệu** — RULED OUT. `DELETE` vẫn chặn đúng bằng `409` bất kể bug này (E3, xác nhận qua Manual Test D2 thật). Bug chỉ ảnh hưởng trải nghiệm UI, không ảnh hưởng dữ liệu.

---

## Root Cause

**Chưa đủ dữ liệu để kết luận.**

Đã loại được 1 khả năng (source code sai/thiếu trên GitHub). Còn lại 3 khả năng (Deployment, Browser cache, Backend query lỗi âm thầm) đều **chưa có bằng chứng runtime** để xác nhận hoặc loại trừ. Không đủ cơ sở để chọn 1 trong 3 làm Root Cause chính thức ở thời điểm này.

---

## Open Questions (cần dữ liệu runtime, chưa cần code)

1. Vercel → tab Deployments → deployment mới nhất có status "Ready" và đúng commit hash của lần push chứa `has_logged_sets` không? (trả lời E4)
2. Sau khi hard-refresh (Ctrl+Shift+R) hoặc mở Incognito, hành vi nút 🗑 có đổi không? (trả lời E5)
3. Mở DevTools → tab Network → tìm request `GET /api/session-exercises?session_id=...` cho đúng session đã test → xem response JSON → field `has_logged_sets` của bài đã log set là `true` hay `false`? (trả lời E6 — đây là bằng chứng quyết định nhất, sẽ tách được Backend vs Frontend/Cache ngay lập tức)

---

## Recommendation

Thu thập thêm 3 bằng chứng ở Open Questions (đều là thao tác kiểm tra thủ công, không phải code) — trong đó **câu 3 (Network tab)** là quan trọng nhất vì tách biệt rõ ràng:
- Nếu response JSON đã đúng `has_logged_sets: true` → bug chắc chắn nằm ở Frontend hoặc Cache (không phải Backend)
- Nếu response JSON sai `has_logged_sets: false` cho bài đã log set → bug nằm ở Backend (khả năng D nêu trên), lúc đó mới cần Root Cause Analysis sâu hơn vào đoạn query `workout_sets`

Sau khi có bằng chứng câu 3, Root Cause Analysis (bước 2) có thể kết luận dứt khoát mà không cần đoán.

---

## Waiting for Approval

Investigation dừng ở đây theo đúng yêu cầu (chỉ điều tra, không code). Chờ bạn:
1. Thực hiện 3 kiểm tra ở Open Questions, hoặc
2. Chỉ định cách tiếp cận khác nếu không muốn tự kiểm tra Network tab (vd. tôi có thể hướng dẫn từng bước cụ thể hơn để bạn tự chụp màn hình response JSON)

Sau khi có bằng chứng, tôi sẽ viết **Root Cause Analysis** (bước 2) dựa trên dữ liệu thật, không dựa trên suy đoán.

---

*Ghi chú quản lý context: cuộc trò chuyện này đã khá dài (nhiều file code lớn, nhiều vòng review). Nếu bạn chuẩn bị bắt đầu Root Cause Analysis hoặc Implementation cho patch này, tôi đề xuất nên bắt đầu ở **chat mới** để tránh context bị đầy. Nếu bạn đồng ý, ở tin nhắn tiếp theo tôi sẽ tạo một Context Summary đầy đủ (toàn bộ ADR, trạng thái Sprint, KL-01, roadmap) để bạn copy sang chat mới mà không mất thông tin.*
