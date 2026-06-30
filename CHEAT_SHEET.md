# Cheat sheet — Sửa file nào khi cần?

## Thêm / sửa bài tập hoặc template
→ Chạy SQL trong Supabase SQL Editor
→ Không cần sửa code

## Đổi màu sắc, font, kích thước nút
→ `app/globals.css`

## Sửa màn hình trang chủ (danh sách template)
→ `app/page.tsx`

## Sửa màn hình tập kháng lực (stepper, RPE, set)
→ `app/workout/[sessionId]/page.tsx`

## Sửa màn hình nhập kết quả chạy bộ
→ `app/workout/[sessionId]/run/page.tsx`

## Sửa màn hình tổng kết buổi tập
→ `app/summary/[sessionId]/page.tsx`

## Sửa danh sách bài tập + form chỉnh tạ
→ `app/exercises/page.tsx`

## Đổi logic tăng tạ (điều kiện RPE, rep)
→ `lib/utils.ts` → hàm `shouldIncreaseWeight`

## Sửa API lấy/lưu sessions
→ `app/api/sessions/route.ts`
→ `app/api/sessions/[id]/route.ts`

## Sửa API lấy/lưu sets
→ `app/api/sets/route.ts`

## Thêm cột mới vào database
→ Chạy ALTER TABLE trong Supabase SQL Editor
→ Cập nhật type trong `lib/supabase.ts`
