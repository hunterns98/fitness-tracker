# FITNESS TRACKER
Architecture Decisions (ADR)

Version: 1.0

=========================================
PROJECT PHILOSOPHY
=========================================

Fitness Tracker không phải một ứng dụng AI.

Đây là một hệ thống lưu trữ dữ liệu tập luyện
được thiết kế để sử dụng nhiều năm.

Triết lý phát triển:

- Offline First
- Free First
- AI Ready
- Data First
- Long-term Maintainable

AI chỉ là công cụ phân tích dữ liệu,
không phải một phần bắt buộc của hệ thống.

=========================================
ADR-001
Database First
=========================================

Mọi dữ liệu phải được lưu đầy đủ.

Không tính toán từ UI.

Dashboard chỉ đọc dữ liệu.

Không lưu dữ liệu tạm trong component.

=========================================
ADR-002
Template chỉ dùng để tạo Session
=========================================

Workout Template chỉ là khuôn mẫu.

Khi tạo Workout Session:

Template
↓

Session

Sau đó Session tồn tại độc lập.

Template thay đổi
không được ảnh hưởng Session đã tạo.

=========================================
ADR-003
Session là nguồn dữ liệu chính
=========================================

Workout History

↓

Session

↓

Session Exercises

không đọc trực tiếp Template.

=========================================
ADR-004
Partial Snapshot
=========================================

Session Exercise chỉ lưu:

- session_id
- exercise_id
- display_order
- target_sets
- target_reps
- notes
- created_from_template_id

Không lưu:

- exercise_name
- muscles
- cue
- image
- video
- equipment
- difficulty

Metadata luôn đọc từ Exercise Library.

Lý do:

- không duplicate data
- dễ mở rộng
- AI luôn đọc metadata mới nhất
- Exercise Library phát triển độc lập

=========================================
ADR-005
Exercise Library dùng Soft Delete
=========================================

Exercise sẽ không bị DELETE.

Thay vào đó:

is_active

hoặc

archived_at

Exercise Archive:

✓ không xuất hiện khi tạo Template

✓ không xuất hiện trong Exercise Picker

✓ Session cũ vẫn đọc được

✓ AI vẫn đọc được

✓ Images vẫn giữ

=========================================
ADR-006
Import phải Idempotent
=========================================

Import nhiều lần

↓

Không được duplicate.

Sử dụng

import_hash

để xác định dữ liệu đã tồn tại.

Application layer
không chịu trách nhiệm chống duplicate.

Database phải đảm bảo.

=========================================
ADR-007
AI Ready
=========================================

Không tích hợp AI trực tiếp.

Không phụ thuộc:

- Claude

- ChatGPT

- Gemini

- OpenAI API

- Anthropic API

Ứng dụng chỉ cần:

Export

↓

Markdown

JSON

CSV

↓

AI phân tích.

=========================================
---

## ADR-008 — Import Hash: Adopt Formula, Backfill Legacy Data
**Date:** Sprint 3 Phase 0 — 2026-07-17
**Status:** ACCEPTED

**Context:**
ADR-006 defined the `import_hash` formula but was never implemented in code (confirmed via audit — Sprint 3 Phase 0 verification). 20 historical Running sessions were already imported prior to this decision, all with implicit `import_hash = NULL`.

**Decision:**
- Adopt ADR-006 formula as-is: `import_hash = sha256(date + type + distance_km + duration_seconds)`, no salt.
- Backfill `import_hash` for the 20 existing historical Running sessions via a one-time migration script, computed with the same formula.
- Sessions created through the app UI (not via import) continue to have `import_hash = NULL` permanently — unchanged from ADR-006.
- Replace application-layer `(date, name_override)` duplicate detection in `api/import/route.ts` with `upsert` on `import_hash`.

**Rollout Order (strict sequence — do not parallelize):**
1. `ALTER TABLE workout_sessions ADD COLUMN import_hash TEXT` + partial unique index (schema first, no app behavior change yet).
2. Run one-time backfill script against the 20 existing Running sessions — verify row count matches before proceeding.
3. Only after step 2 is confirmed complete: deploy the code change in `api/import/route.ts` that switches dedup logic from `(date, name_override)` to `import_hash` upsert.

Deploying step 3 before step 2 completes would cause the 20 legacy sessions (still `import_hash = NULL`) to no longer be protected by the old `(date, name_override)` check, risking duplicate creation on next import.

**Consequences:**
- Re-importing the original historical Excel file will correctly recognize the 20 existing sessions and skip them.
- New Running imports become idempotent by hash, closing TD-01.
- Requires the 3-step rollout above; skipping or reordering steps reintroduces duplicate risk during the transition window.

## ADR-009 — Remove Duplicate Dashboard Routes; Enforce `/api/*` Convention
**Date:** Sprint 3 Phase 0 — 2026-07-17
**Status:** ACCEPTED

**Context:**
Four route files existed outside the `app/api/*` convention: `app/dashboard/{body,recovery,running,strength}/route.ts`. Two were byte-identical duplicates of their `app/api/dashboard/*` counterparts; two contained diverging query logic. Confirmed via code review that no client code calls these paths directly — they are live (Next.js serves any `route.ts` under `app/`) but orphaned.

**Decision:**
- Delete all four files under `app/dashboard/*/route.ts`.
- Formal convention going forward: **all API routes must live under `app/api/*`**. No exceptions.

**Consequences:**
- Removes dead, reachable endpoints with no test coverage or intentional ownership.
- Eliminates risk of divergent duplicate logic (`running`, `strength` variants) accidentally being wired up in future refactors.
- Sprint 3 (Exercise Library) route additions must follow this convention.

---

## ADR-010 — AI Coach Downgraded to Experimental
**Date:** Sprint 3 Phase 0 — 2026-07-17
**Status:** ACCEPTED

**Context:**
- `app/api/ai-coach/route.ts` calls the Anthropic API (`api.anthropic.com`) directly at request time.
- `PROJECT_ROADMAP.txt`, Sprint 7 ("AI Export"), states: *"Không tích hợp AI. Không gọi API. Không cần API Key. Không phát sinh chi phí."*
- `PROJECT_ROADMAP.txt` lists "AI Coach" only under the "FUTURE IDEAS" section. It does not appear in Sprint 1 or Sprint 2 Planning scope.
- Verified (Sprint 3 Phase 0, V2 — runtime check): `ANTHROPIC_API_KEY` is not configured in Vercel Environment Variables.

**Decision:**
- AI Coach status: **Experimental**.
- Remove the `🤖 AI Coach` entry point from the Dashboard header.
- No further engineering time on its runtime bugs (missing `x-api-key`/`anthropic-version` headers) under this status.
- Code remains in the repository, unremoved.
- Any future change to this status requires a Sprint Planning entry.

**Consequences:**
- Dashboard UI no longer surfaces this feature as a primary navigation item.
- Feature remains present in code but unadvertised, pending a future decision.
