# Fitness Tracker — Setup hoàn toàn trên trình duyệt

> Không cần cài Node.js, không cần terminal. Chỉ cần trình duyệt.

---

## Tổng quan workflow

```
Bạn upload code lên GitHub (web UI)
      ↓
Vercel tự động build trên cloud
      ↓
Bạn nhận được URL → mở bằng điện thoại/máy tính
      ↓
Feedback → Claude sửa code → lặp lại
```

---

## Bước 1 — Tạo GitHub repository

1. Vào [github.com](https://github.com) → đăng nhập
2. Nhấn **"New repository"** (nút xanh góc trên phải)
3. Đặt tên: `fitness-tracker`
4. Chọn **Private** (vì có password app trong env vars)
5. Nhấn **"Create repository"**

---

## Bước 2 — Upload code lên GitHub

1. Trong repo vừa tạo, nhấn **"uploading an existing file"**
2. Kéo thả toàn bộ folder `fitness-tracker` vào
3. Nhấn **"Commit changes"**

> 💡 Cách nhanh hơn: dùng [github.dev](https://github.dev) — mở VS Code trên trình duyệt,
> kéo thả file vào, Ctrl+S để save, tự sync lên GitHub.

---

## Bước 3 — Tạo Supabase project

1. Vào [supabase.com](https://supabase.com) → **"New project"**
2. Đặt tên, chọn region **Southeast Asia (Singapore)**
3. Đợi ~2 phút để khởi tạo

**Lấy thông tin cần thiết:**
- Vào **Project Settings → API**
- Copy **Project URL** (dạng `https://xxx.supabase.co`)
- Copy **service_role** key (ở phần "Project API keys", nhấn "Reveal" để hiện)

**Chạy database schema:**
- Vào **SQL Editor** (menu trái)
- Nhấn **"New query"**
- Copy toàn bộ nội dung file `supabase/schema.sql` trong repo, paste vào
- Nhấn **"Run"**
- Kết quả: tất cả bảng + 21 bài tập + 6 template được tạo tự động

---

## Bước 4 — Deploy lên Vercel

1. Vào [vercel.com](https://vercel.com) → **"Sign up"** (chọn "Continue with GitHub")
2. Nhấn **"Add New Project"**
3. Chọn repo `fitness-tracker` → **"Import"**
4. Trước khi deploy, nhấn **"Environment Variables"**, thêm 5 biến:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | URL lấy từ Supabase (bước 3) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (bước 3) |
| `APP_PASSWORD` | Mật khẩu bạn tự đặt (vd: `myfit2026`) |
| `SESSION_SECRET` | Chuỗi random ≥ 32 ký tự (vd: `abcdefghijklmnopqrstuvwxyz123456`) |
| `NEXT_PUBLIC_BASE_URL` | Để trống (Vercel tự điền sau khi deploy) |

5. Nhấn **"Deploy"** → đợi ~2 phút
6. Vercel cho bạn URL dạng `https://fitness-tracker-xxx.vercel.app`

---

## Bước 5 — Thêm vào màn hình điện thoại (PWA)

**iOS Safari:**
Mở URL → nhấn nút Share (□↑) → "Add to Home Screen"

**Android Chrome:**
Mở URL → nhấn menu (⋮) → "Add to Home Screen"

App sẽ mở như native app, không có thanh địa chỉ.

---

## Workflow phát triển tiếp theo

### Khi Claude sửa 1 file:
1. Vào repo trên [github.com](https://github.com)
2. Tìm file cần sửa → nhấn ✏️ (Edit)
3. Paste code mới → **"Commit changes"**
4. Vercel tự động redeploy (~1 phút)
5. Mở URL kiểm tra

### Khi Claude sửa nhiều file:
1. Vào `github.com/[username]/fitness-tracker/`
2. Nhấn `.` (dấu chấm) → mở VS Code trên trình duyệt (github.dev)
3. Sửa file → Ctrl+S
4. Nhấn icon Source Control (góc trái) → nhập commit message → Commit & Push
5. Vercel tự redeploy

---

## Cấu trúc project

```
app/
  page.tsx                    ← Trang chủ: chọn buổi tập
  login/page.tsx              ← Đăng nhập
  workout/[sessionId]/
    page.tsx                  ← Active workout (kháng lực)
    run/page.tsx              ← Active workout (chạy bộ)
  summary/[sessionId]/
    page.tsx                  ← Tổng kết + progressive overload hint
  exercises/page.tsx          ← CSDL bài tập
  api/...                     ← Backend API routes (chạy trên Vercel serverless)

lib/
  supabase.ts                 ← Kết nối database
  auth.ts                     ← Xử lý login/cookie
  utils.ts                    ← Tính pace, duration, overload

supabase/schema.sql           ← Chạy 1 lần trong Supabase SQL Editor
```

---

## Giải thích: tại sao không cần Node.js trên máy?

- **Build**: Vercel nhận code từ GitHub, tự chạy `npm install` + `npm build` trên server của họ
- **Database**: Supabase chạy trên cloud, bạn config qua web UI
- **Deploy**: Tự động mỗi khi push lên GitHub
- **Bạn chỉ cần**: trình duyệt + GitHub account + Vercel account + Supabase account

Đây đúng với workflow game của bạn (Ma Sói, Flip 7...), chỉ thay Firebase bằng Supabase và GitHub Pages bằng Vercel.
# Fitness Tracker

Personal Fitness Tracker

## Features

- Workout
- Running
- Nutrition
- Sleep
- Dashboard

## Tech Stack

- Next.js
- Supabase
- Tailwind
- Vercel

## Development

See:

- ROADMAP.md
- CHANGELOG.md
- docs/ARCHITECTURE.md
