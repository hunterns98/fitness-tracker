# Sprint 1 Retrospective

**Version: v0.1.0 — Sprint 1 Stable**
**Date: 2026-07-09**

---

## Mục tiêu Sprint

Ổn định ứng dụng để sử dụng được hằng ngày.
Không làm tính năng mới, không redesign, không refactor kiến trúc lớn.

---

## Những gì đã hoàn thành

| Task | Kết quả |
|---|---|
| T1 (P0) Running Import | ✅ PASS — sheet "Running" được nhận dạng, duplicate-safe |
| T2 (P1) UUID undefined | ✅ PASS — defensive programming, không còn URL `/undefined` |
| T3 (P2) Rest Day | ✅ PASS — khôi phục đủ chức năng |
| Root cause analysis | ✅ Hoàn thành trước khi code, được Product Owner review và đồng ý |

---

## Những gì làm tốt

**1. Root cause analysis trước khi code**
Sprint này bắt đầu bằng phân tích kỹ nguyên nhân của 4 bugs trước khi chạm vào code. Nhờ đó:
- Không fix nhầm chỗ
- Xác định đúng scope của từng task
- Không tạo ra bugs mới

**2. Phân tách Bug 3 ra Sprint sau**
Bug 3 (Workout Template locked) được xác định là vấn đề kiến trúc, không phải bug đơn giản. Quyết định không implement trong Sprint 1 là đúng — tránh scope creep và rủi ro data.

**3. Duplicate detection trước khi insert**
Thay vì để user phát hiện duplicate sau khi import, API chủ động detect và skip trước. UI hiển thị rõ "Bỏ qua (trùng)" — user hiểu chuyện gì xảy ra.

**4. Sprint Report format được cải thiện**
Feedback từ Product Owner về Expected/Actual/Evidence được áp dụng ngay trong Sprint. Report lần sau sẽ đúng format từ đầu.

---

## Những gì cần cải thiện

**1. Nutrition bị thêm vào ngoài scope**
Nutrition import được thêm vào `api/import/route.ts` trong khi Sprint 1 không có task này. Dù không gây lỗi, nhưng đây là scope creep — feature chưa được test, chưa được review, đang ở trạng thái "Experimental". Cần discipline hơn: nếu không trong sprint backlog thì không code.

**2. Test 5 không thực hiện được**
Defensive code cho API failure được viết nhưng chưa verify thực tế vì không có môi trường test. Cần thiết lập cách mô phỏng API failure (vd: temporarily break env var) để verify defensive code.

**3. Duplicate key dùng application layer thay vì DB constraint**
L1 và L2 là technical debt có thể tránh được nếu thiết kế schema tốt hơn từ đầu. Trong tương lai, mọi import logic cần unique constraint ở DB layer, không phải application layer.

---

## Technical Debt còn lại

| ID | Mô tả | Priority |
|---|---|---|
| TD-01 | Duplicate detection dùng `(date + name_override)` — cần `import_hash` column | High |
| TD-02 | Nutrition import chưa được test — đang ở Experimental | Medium |
| TD-03 | Test 5 (API failure defensive code) chưa verify | Low |
| TD-04 | Bug 3: Workout Template bị lock — cần `session_exercises` layer | High |
| TD-05 | Workout Session không snapshot template tại thời điểm tập — nếu template thay đổi, UI lịch sử bị sai | High |

---

## Lessons Learned

**L1 — Phân tích trước, code sau**
Root cause analysis rõ ràng trước khi bắt đầu code giúp Sprint đi đúng hướng và không tạo ra bugs mới. Đây là bước không thể bỏ qua.

**L2 — Sprint scope phải được enforce nghiêm**
Nutrition code được thêm vào "tiện tay" mà không có task tương ứng. Dù nhỏ, đây là dấu hiệu của scope creep. Mỗi dòng code phải có task trong sprint backlog.

**L3 — Known Limitations phải được document ngay khi biết**
L1 và L2 được phát hiện trong quá trình implement nhưng không được document ngay. Sprint Report nên có mục Known Limitations được điền trong quá trình code, không phải sau khi test.

**L4 — Report format cần nhất quán từ đầu**
Format Expected/Actual/Evidence/Status phải là template chuẩn từ Sprint đầu tiên. Không nên chờ feedback từ Product Owner mới điều chỉnh.

---

## Quyết định kiến trúc quan trọng

**AD-01: Không implement session_exercises trong Sprint 1**
Quyết định: Deferred sang Sprint 2.
Lý do: Thay đổi schema + migration logic có rủi ro ảnh hưởng data. Sprint 1 chỉ tập trung stability.
Impact: Workout Template vẫn bị lock. Người dùng không thể thêm/xóa/đổi thứ tự bài tập.

**AD-02: Duplicate detection ở application layer**
Quyết định: Dùng `(date + name_override)` composite key ở app layer thay vì DB constraint.
Lý do: Sprint 1 không cho phép thay đổi schema.
Impact: Giải pháp tạm, có known limitations L1 và L2.
Plan: Sprint 2 thêm `import_hash` unique column.

**AD-03: Nutrition import đánh dấu Experimental**
Quyết định: Code được merge nhưng đánh dấu NOT TESTED, không announce là feature hoàn thành.
Lý do: Code đã có trong file, remove sẽ tạo thêm thay đổi không cần thiết.
Plan: Sprint 2 validate và test đầy đủ.

---

## Chuyển sang Sprint 2

| Item | Lý do chuyển |
|---|---|
| session_exercises (Bug 3) | Schema change — cần thiết kế kỹ trước khi implement |
| import_hash column (TD-01) | Schema change — cần migration plan |
| Nutrition import validation (TD-02) | Chưa test, chưa trong scope Sprint 1 |
| Test 5 verify | Cần môi trường test |
