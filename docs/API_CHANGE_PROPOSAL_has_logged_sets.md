# Additive API Change — `has_logged_sets` trong GET /api/session-exercises

**Lý do:** UI cần biết trước (không cần gọi DELETE thử) bài nào đã có `workout_sets` để disable nút 🗑 ngay từ đầu, thay vì để user confirm rồi mới nhận lỗi 409.

**Loại thay đổi:** Additive, read-only, chỉ trong 1 hàm `GET`. Không đổi:
- Schema DB (không thêm cột, không thêm bảng)
- `POST` / `DELETE` / `move` (giữ nguyên 100%, kể cả guard 409 trên DELETE)
- Response shape cũ — chỉ **thêm 1 field mới** `has_logged_sets: boolean`, không xóa/đổi field nào đang có

**Cách làm:** Trong `GET`, sau khi có `sessionExercises` (path 1) hoặc `templateExercises` (path 2 — fallback), query thêm 1 lần `workout_sets` theo `session_id`, lấy `exercise_id` distinct, dùng `Set` để đánh dấu bài nào có set đã log. 1 query bổ sung, filter theo `session_id` (đã có sẵn dùng ở nhiều API khác trong app, không phải pattern mới).

**Rủi ro:** Rất thấp — chỉ thêm 1 SELECT nhỏ, dữ liệu single-user, số lượng set mỗi session nhỏ.

---

## Diff cụ thể (trong `app/api/session-exercises/route.ts`, chỉ trong `GET`)

**Thêm sau khi có `sessionExercises` (path 1), trước khi map `result`:**

```ts
if (sessionExercises && sessionExercises.length > 0) {
  // ── MỚI: lấy danh sách exercise_id đã có set log trong session này ──
  const { data: loggedSets } = await supabase
    .from('workout_sets')
    .select('exercise_id')
    .eq('session_id', sessionId)
  const loggedExerciseIds = new Set((loggedSets ?? []).map(r => r.exercise_id))

  const result = sessionExercises.map(se => {
    const ex = se.exercise as any
    return {
      id: se.exercise_id,
      session_exercise_id: se.id,
      name: ex?.name ?? 'Bài tập không xác định',
      muscle_group: ex?.muscle_group ?? null,
      current_weight_kg: ex?.current_weight_kg ?? null,
      technique_cue: ex?.technique_cue ?? null,
      target_sets: se.target_sets,
      target_reps: se.target_reps,
      notes: se.notes,
      has_logged_sets: loggedExerciseIds.has(se.exercise_id), // ← MỚI
      _source: 'session_exercises',
    }
  })
  return NextResponse.json(result)
}
```

**Path 2 (fallback)** — thêm cho nhất quán shape, dù Workout Editor hiện đang ẩn hoàn toàn với session fallback nên field này không thực sự được dùng ở path này:

```ts
const fallbackResult = (templateExercises ?? []).map(te => ({
  ...(te.exercise as any),
  has_logged_sets: false, // fallback session không track qua field này, giữ shape nhất quán
  _source: 'template_fallback',
}))
```

Toàn bộ file đầy đủ nằm trong `app/api/session-exercises/route.ts` được đính kèm cùng file này.
