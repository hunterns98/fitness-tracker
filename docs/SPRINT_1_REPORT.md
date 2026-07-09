# Sprint 1 — Final Report

**Sprint Status: ✅ PASS**
**Sprint Decision: CLOSED**
**Version: v0.1.0**
**Release Name: Sprint 1 Stable**
**Sprint Period:** 2025–07 (Week 1)
**Closed:** 2026-07-09

---

## Mục tiêu Sprint

Ổn định ứng dụng để có thể sử dụng hằng ngày.
Không redesign UI, không thêm feature mới, không refactor kiến trúc lớn.
Chỉ sửa các lỗi đang chặn việc sử dụng app.

---

## Manual Test Results

| # | Test Case | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|
| 1 | Tạo Easy Run → nhập kết quả → lưu | Không lỗi UUID, lưu thành công, navigate đúng trang | Lưu thành công, không còn lỗi UUID | ✅ PASS | User confirmed |
| 2 | Import `fitness-history-import.xlsx` lần 1 | 20 running imported, 0 skipped, 0 lỗi | Import thành công | ✅ PASS | User confirmed |
| 3 | Import cùng file lần 2 | 0 imported, 20 skipped (trùng), 0 lỗi | Duplicate detection hoạt động đúng | ✅ PASS | User confirmed |
| 4 | Tap ngày → `+ Thêm` → Nghỉ ngơi → Confirm | Tạo session, navigate `/summary` | Rest Day hoạt động đúng | ✅ PASS | User confirmed |
| 5 | API tạo session thất bại (mô phỏng) | Hiện lỗi đỏ, không navigate `/undefined` | — | ⚪ NOT TESTED | Không mô phỏng được trong môi trường production |

---

## Files Modified

| File | Task | Mô tả |
|---|---|---|
| `app/day/[date]/page.tsx` | T2 + T3 | Fix UUID undefined, thêm Rest Day, defensive guard |
| `app/api/import/route.ts` | T1 | Fix SHEET_MAP, duplicate detection, nutrition (experimental) |
| `app/data/page.tsx` | T1 | Hiển thị skipped count trong import result UI |

---

## Changes Detail

### T1 (P0) — Running Import
- `data/page.tsx`: Thêm `'Running': 'running'` vào SHEET_MAP
- `api/import/route.ts`: Duplicate detection qua `(date, name_override)` ở application layer
- `api/import/route.ts`: ⚠️ Nutrition support — **Experimental, NOT TESTED**
- `data/page.tsx`: UI hiển thị 3 cột: Đã import / Bỏ qua (trùng) / Lỗi

### T2 (P1) — UUID undefined
- Xóa `body.run_type_custom` — field không có trong schema
- Guard: `if (!res.ok || !session.id || typeof session.id !== 'string')` → không navigate
- try/catch bọc `createSession()`, hiện `createError` nếu thất bại
- URL `/workout/undefined/run` không thể xuất hiện

### T3 (P2) — Rest Day
- Grid 4 nút (2×2): Kháng lực / Chạy bộ / Khác / Nghỉ ngơi
- Rest panel có bước confirm → session `name_override: 'Nghỉ ngơi'` → navigate `/summary`

---

## Known Limitations

| # | Limitation | Impact | Fix Plan |
|---|---|---|---|
| L1 | Duplicate detection dùng `(date + name_override)` ở app layer, không phải DB constraint | Nếu cùng ngày có 2 buổi chạy cùng tên → buổi 2 bị skip sai | Sprint 2: thêm `import_hash` unique column |
| L2 | `name_override = null` → key `date|` có thể collision | Nhiều session null cùng ngày bị skip sai | Sprint 2: cùng với L1 |
| L3 | Nutrition import — Experimental, NOT TESTED | Chưa xác nhận hoạt động đúng | Sprint 2: validate và test đầy đủ |
| L4 | Test 5 (API failure) chưa được test | Defensive code có nhưng chưa verify thực tế | Sprint 2: thiết lập môi trường test |

---

## Migration
**None required** — Sprint 1 là code-only changes, không thay đổi schema.
