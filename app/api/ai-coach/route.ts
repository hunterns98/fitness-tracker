import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `Bạn là huấn luyện viên cá nhân theo dõi người dùng lâu dài. Luôn trả lời bằng tiếng Việt.

LỊCH SỬ VÀ BỐI CẢNH NGƯỜI DÙNG:
- Kết hợp tập kháng lực (Dumbbell, Ring Fit) + chạy bộ 3 buổi/tuần
- Mục tiêu: Body recomposition — giảm mỡ, tăng cơ, giữ cân 62-63kg
- Áp dụng progressive overload: tăng tạ khi form tốt, ưu tiên cảm nhận cơ
- Chạy bộ: Easy/Tempo/Interval, pace easy ~8-9 phút/km, 6-10km/buổi
- Dinh dưỡng: cân bằng, ưu tiên đủ protein, không cực đoan
- Cân nặng đã giảm từ 63-64kg xuống ~62kg, vòng eo giảm, tỷ lệ mỡ giảm

NGUYÊN TẮC PHÂN TÍCH:
1. Dựa trên dữ liệu thực, không giả định khi thiếu data
2. So sánh xu hướng dài hạn, không chỉ một ngày
3. Không tâng bốc, phân tích rõ ràng có lý do
4. Nếu thiếu dữ liệu, nói rõ thay vì tự suy đoán

PHONG CÁCH TƯ VẤN:
- Phân tích rõ ràng, có lý do, dựa trên dữ liệu
- Chỉ ra: điều đang làm tốt / điều hạn chế / nên thay đổi / nên giữ nguyên
- Không khuyên cắt giảm nếu không cần thiết
- Đặc biệt chú ý chấn thương: đầu gối, đùi sau, cẳng chân, cổ chân, lưng dưới

FORMAT PHÂN TÍCH (dùng markdown, mỗi mục có emoji):

## 💪 Tiến triển tập luyện
[Nhận xét về strength progression, tăng tạ, volume]

## 🏗 Tăng cơ
[Kích thích nhóm cơ, form, nhóm cơ thiếu kích thích]

## 🏃 Chạy bộ
[Phân bổ Easy/Tempo/Interval, ảnh hưởng lên cơ, dấu hiệu quá tải]

## ⚖️ Body Recomposition
[Mất mỡ hay mất cơ, cân nặng thay đổi hợp lý không, điều chỉnh ăn uống]

## 🛡 Phục hồi & Chấn thương
[Resting HR, giấc ngủ, dấu hiệu overtraining, cảnh báo chấn thương]

## ✅ Kết luận & Tuần tới
[Tóm tắt ngắn gọn: giữ nguyên gì, thay đổi gì, tăng tải hay không]`

export async function POST(req: NextRequest) {
  const { mode } = await req.json().catch(() => ({ mode: 'week' }))

  // Tính khoảng thời gian
  const now = new Date()
  const daysBack = mode === 'month' ? 30 : 7
  const since = new Date(now)
  since.setDate(since.getDate() - daysBack)
  const sinceStr = since.toISOString().split('T')[0]

  try {
    // Lấy dữ liệu song song
    const [sessionsRes, setsRes, sleepRes, bodyRes] = await Promise.all([
      supabase.from('workout_sessions')
        .select('id, date, type, name_override, duration_seconds, distance_km, avg_pace_seconds, avg_hr, max_hr, calories, feeling_note, workout_templates(name, run_type)')
        .gte('date', sinceStr)
        .order('date', { ascending: true }),
      supabase.from('workout_sets')
        .select('session_id, set_number, reps, weight_kg, rpe, note, exercises(name, muscle_group)')
        .gte('created_at', since.toISOString()),
      supabase.from('sleep_recovery_logs')
        .select('date, resting_hr, sleep_score, sleep_duration_min, wake_count, energy_level, note')
        .gte('date', sinceStr)
        .order('date', { ascending: true }),
      supabase.from('body_metrics')
        .select('date, weight_kg, body_fat_pct, lean_mass_kg, waist_cm')
        .order('date', { ascending: false })
        .limit(4),
    ])

    const sessions = sessionsRes.data ?? []
    const sets = setsRes.data ?? []
    const sleep = sleepRes.data ?? []
    const body = bodyRes.data ?? []

    // Group sets theo session
    const setsBySession: Record<string, typeof sets> = {}
    for (const s of sets) {
      if (!setsBySession[s.session_id]) setsBySession[s.session_id] = []
      setsBySession[s.session_id].push(s)
    }

    // Build prompt data
    const sessionSummaries = sessions.map(s => {
      const name = s.name_override ?? (s.workout_templates as any)?.name ?? s.type
      const dur = s.duration_seconds ? `${Math.round(s.duration_seconds / 60)}p` : ''
      const dist = s.distance_km ? `${s.distance_km}km` : ''
      const pace = s.avg_pace_seconds ? `pace ${Math.floor(s.avg_pace_seconds/60)}:${(s.avg_pace_seconds%60).toString().padStart(2,'0')}/km` : ''
      const hr = s.avg_hr ? `HR TB ${s.avg_hr}` : ''
      const note = s.feeling_note ? `Cảm giác: "${s.feeling_note}"` : ''

      const sessionSets = setsBySession[s.id] ?? []
      const setsByEx: Record<string, typeof sessionSets> = {}
      for (const set of sessionSets) {
        const exName = (set.exercises as any)?.name ?? 'Unknown'
        if (!setsByEx[exName]) setsByEx[exName] = []
        setsByEx[exName].push(set)
      }

      const setsDetail = Object.entries(setsByEx).map(([exName, exSets]) => {
        const detail = exSets.map(es => `${es.weight_kg}kg×${es.reps}${es.rpe ? ` RPE${es.rpe}` : ''}`).join(', ')
        return `    • ${exName}: ${detail}`
      }).join('\n')

      return `[${s.date}] ${name} | ${[dur, dist, pace, hr].filter(Boolean).join(' | ')}
${setsDetail}${note ? '\n  ' + note : ''}`
    }).join('\n\n')

    const sleepSummary = sleep.map(s =>
      `[${s.date}] HR nghỉ: ${s.resting_hr ?? '?'}bpm | Điểm ngủ: ${s.sleep_score ?? '?'} | Thời gian: ${s.sleep_duration_min ? Math.round(s.sleep_duration_min/60*10)/10 + 'h' : '?'} | Thức: ${s.wake_count ?? '?'} lần | Năng lượng: ${s.energy_level ?? '?'}`
    ).join('\n')

    const bodySummary = body.map(b =>
      `[${b.date}] Cân: ${b.weight_kg}kg | Mỡ: ${b.body_fat_pct}% | Lean: ${b.lean_mass_kg}kg | Eo: ${b.waist_cm}cm`
    ).join('\n')

    const userPrompt = `Hãy phân tích ${daysBack === 7 ? 'tuần' : 'tháng'} tập luyện của tôi.

=== BUỔI TẬP (${sinceStr} đến hôm nay) ===
${sessionSummaries || 'Không có dữ liệu buổi tập'}

=== GIẤC NGỦ & PHỤC HỒI ===
${sleepSummary || 'Không có dữ liệu giấc ngủ'}

=== SỐ LIỆU CƠ THỂ (gần nhất) ===
${bodySummary || 'Không có dữ liệu cơ thể'}

Hãy phân tích theo 5 góc độ như đã hướng dẫn.`

    // Gọi Claude API
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.json()
      return NextResponse.json({ error: err.error?.message ?? 'Claude API error' }, { status: 500 })
    }

    const claudeData = await claudeRes.json()
    const analysis = claudeData.content?.find((b: any) => b.type === 'text')?.text ?? ''

    return NextResponse.json({
      analysis,
      period: { from: sinceStr, to: now.toISOString().split('T')[0] },
      stats: {
        sessions: sessions.length,
        strengthSessions: sessions.filter(s => s.type === 'strength').length,
        runSessions: sessions.filter(s => s.type === 'run').length,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
