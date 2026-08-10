'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  current_weight_kg: number | null
  target_reps: string | null
  target_sets: number | null
  technique_cue: string | null
  difficulty: string | null
  archived_at: string | null
  // Sprint 6 (additive, client-side only — field đã tồn tại trong DB/API,
  // chỉ chưa được đọc/dùng trong type cũ của trang này)
  equipment: string[] | null
  movement_pattern: string | null
}

// Thứ tự hiển thị hợp lý cho Difficulty (không phải taxonomy mới — chỉ là
// thứ tự ưu tiên khi render; danh sách thực tế vẫn derive + lọc theo dữ
// liệu thật, giá trị nào không tồn tại trong data sẽ không hiện ra).
const DIFFICULTY_DISPLAY_ORDER = ['Beginner', 'Intermediate', 'Advanced']

// ── Sprint 6: helper filter predicates (thuần, không phụ thuộc component
// state) — mở rộng tường minh, không tạo generic filter engine ──────────
function matchesAdvancedFilters(
  e: Exercise,
  eq: string[],
  diff: string[],
  mp: string[]
): boolean {
  if (eq.length > 0 && !(e.equipment ?? []).some(x => eq.includes(x))) return false
  if (diff.length > 0 && !diff.includes(e.difficulty ?? '')) return false
  if (mp.length > 0 && !mp.includes(e.movement_pattern ?? '')) return false
  return true
}

function matchesSearch(e: Exercise, q: string): boolean {
  if (!q) return true
  return (
    e.name.toLowerCase().includes(q) ||
    e.muscle_group.toLowerCase().includes(q) ||
    (e.technique_cue ?? '').toLowerCase().includes(q)
  )
}

// ── Sprint 6: component nhỏ dùng chung cho danh sách checkbox filter,
// tái sử dụng ở cả Bottom Sheet (mobile) và dropdown (desktop) ─────────
function FilterCheckboxList({
  options, selected, onToggle,
}: {
  options: string[]; selected: string[]; onToggle: (value: string) => void
}) {
  if (options.length === 0) {
    return <p className="text-xs py-2" style={{ color: 'var(--text-3)' }}>Chưa có dữ liệu</p>
  }
  return (
    <div className="space-y-1">
      {options.map(opt => {
        const isSelected = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
            style={{ minHeight: 44, background: isSelected ? 'var(--brand-light)' : 'transparent' }}
          >
            <span
              className="flex items-center justify-center rounded-md shrink-0"
              style={{
                width: 20, height: 20,
                border: `1.5px solid ${isSelected ? 'var(--brand)' : 'var(--border-strong)'}`,
                background: isSelected ? 'var(--brand)' : 'transparent',
              }}
            >
              {isSelected && <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>}
            </span>
            <span className="text-sm font-medium" style={{ color: isSelected ? 'var(--brand-dark)' : 'var(--text)' }}>
              {opt}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Sprint 6: chip cho dải Active Filters, nút × có vùng chạm mở rộng
// tới ~44px bằng padding âm định vị tuyệt đối, không phóng to chip ─────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full text-xs font-medium shrink-0"
      style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)' }}
    >
      {label}
      <button
        onClick={onRemove}
        aria-label={`Bỏ lọc ${label}`}
        className="relative flex items-center justify-center rounded-full"
        style={{ width: 22, height: 22 }}
      >
        <span className="absolute" style={{ inset: -11 }} />
        <span style={{ fontSize: 14, lineHeight: 1 }}>×</span>
      </button>
    </span>
  )
}

export default function ExercisesPage() {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string | null>(null) // muscle_group — không đổi
  const [showArchived, setShowArchived] = useState(false)

  // ── Sprint 6: applied state (thực sự dùng để lọc danh sách chính) ────
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([])
  const [selectedMovementPatterns, setSelectedMovementPatterns] = useState<string[]>([])

  // ── Sprint 6: draft state (chỉ dùng trong lúc Bottom Sheet đang mở) ──
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [draftEquipment, setDraftEquipment] = useState<string[]>([])
  const [draftDifficulties, setDraftDifficulties] = useState<string[]>([])
  const [draftMovementPatterns, setDraftMovementPatterns] = useState<string[]>([])

  // ── Sprint 6: desktop popover đang mở (chỉ 1 tại 1 thời điểm) ────────
  const [openDesktopFilter, setOpenDesktopFilter] = useState<'difficulty' | 'equipment' | 'movementPattern' | null>(null)

  useEffect(() => {
    setLoading(true)
    const status = showArchived ? 'all' : 'active'
    fetch(`/api/exercises?status=${status}`)
      .then(r => r.json())
      .then((data: Exercise[]) => { setExercises(Array.isArray(data) ? data : []); setLoading(false) })
  }, [showArchived])

  // Filter chip derive trực tiếp từ dữ liệu DB, không hardcode
  const groups = useMemo(() => {
    const set = new Set(exercises.map(e => e.muscle_group).filter(Boolean))
    return Array.from(set).sort()
  }, [exercises])

  // ── Sprint 6: derive động 3 danh sách filter phụ từ dữ liệu thật ─────
  const equipmentOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of exercises) for (const eq of e.equipment ?? []) set.add(eq)
    return Array.from(set).sort()
  }, [exercises])

  const difficultyOptions = useMemo(() => {
    const existing = new Set(exercises.map(e => e.difficulty).filter(Boolean) as string[])
    return DIFFICULTY_DISPLAY_ORDER.filter(d => existing.has(d))
  }, [exercises])

  const movementPatternOptions = useMemo(() => {
    const set = new Set(exercises.map(e => e.movement_pattern).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [exercises])

  const advancedFilterCount = selectedEquipment.length + selectedDifficulties.length + selectedMovementPatterns.length

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter(e => {
      if (filter && e.muscle_group !== filter) return false
      if (!matchesAdvancedFilters(e, selectedEquipment, selectedDifficulties, selectedMovementPatterns)) return false
      return matchesSearch(e, q)
    })
  }, [exercises, search, filter, selectedEquipment, selectedDifficulties, selectedMovementPatterns])

  // ── Sprint 6: đếm real-time theo DRAFT cho nút "Xem N bài" ───────────
  const draftMatchCount = useMemo(() => {
    if (!showFilterSheet) return 0
    const q = search.trim().toLowerCase()
    return exercises.filter(e => {
      if (filter && e.muscle_group !== filter) return false
      if (!matchesAdvancedFilters(e, draftEquipment, draftDifficulties, draftMovementPatterns)) return false
      return matchesSearch(e, q)
    }).length
  }, [showFilterSheet, exercises, search, filter, draftEquipment, draftDifficulties, draftMovementPatterns])

  // ── Sprint 6: mở/đóng/apply Bottom Sheet ─────────────────────────────
  function openFilterSheet() {
    setDraftEquipment([...selectedEquipment])
    setDraftDifficulties([...selectedDifficulties])
    setDraftMovementPatterns([...selectedMovementPatterns])
    setShowFilterSheet(true)
  }
  function closeFilterSheetWithoutApply() {
    // Không copy draft → applied. Draft sẽ bị ghi đè đúng bằng applied
    // ở lần openFilterSheet() kế tiếp — tương đương "bỏ thay đổi draft".
    setShowFilterSheet(false)
  }
  function applyFilterSheet() {
    setSelectedEquipment(draftEquipment)
    setSelectedDifficulties(draftDifficulties)
    setSelectedMovementPatterns(draftMovementPatterns)
    setShowFilterSheet(false)
  }
  function clearDraftFilters() {
    setDraftEquipment([])
    setDraftDifficulties([])
    setDraftMovementPatterns([])
  }
  function toggleInArray(setFn: React.Dispatch<React.SetStateAction<string[]>>, value: string) {
    setFn(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  // ── Sprint 6: Active Filters (applied) — xóa từng cái hoặc xóa tất cả ─
  function clearAppliedFilters() {
    setSelectedEquipment([])
    setSelectedDifficulties([])
    setSelectedMovementPatterns([])
  }
  function removeActiveFilter(group: 'equipment' | 'difficulty' | 'movementPattern', value: string) {
    if (group === 'equipment') setSelectedEquipment(prev => prev.filter(v => v !== value))
    else if (group === 'difficulty') setSelectedDifficulties(prev => prev.filter(v => v !== value))
    else setSelectedMovementPatterns(prev => prev.filter(v => v !== value))
  }

  // ── Sprint 6: Empty state — phân biệt Search vs Filter ───────────────
  const hasSearch = search.trim().length > 0
  const hasAdvancedFilter = advancedFilterCount > 0
  const isEmpty = !loading && displayed.length === 0
  const filterSummaryText = [...selectedDifficulties, ...selectedEquipment, ...selectedMovementPatterns].join(' + ')

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }} className="px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>←</button>
        <h1 className="font-bold" style={{ color: 'var(--text)' }}>Bài tập</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Search */}
        <input
          className="input"
          placeholder="Tìm theo tên, nhóm cơ, kỹ thuật..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {/* Filter chips (muscle_group) + Bộ lọc (mobile) + filter phụ (desktop) */}
        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
          <button onClick={() => setFilter(null)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: filter === null ? 'var(--brand)' : 'var(--surface)', color: filter === null ? 'white' : 'var(--text-2)', border: '1px solid var(--border)' }}>
            Tất cả
          </button>
          {groups.map(g => (
            <button key={g} onClick={() => setFilter(f => f === g ? null : g)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{ background: filter === g ? 'var(--brand)' : 'var(--surface)', color: filter === g ? 'white' : 'var(--text-2)', border: '1px solid var(--border)' }}>
              {g}
            </button>
          ))}

          {/* Mobile: nút Bộ lọc gộp cuối dải chip (Sprint 6) */}
          <button
            onClick={openFilterSheet}
            className="shrink-0 md:hidden px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: advancedFilterCount > 0 ? 'var(--brand)' : 'var(--surface)',
              color: advancedFilterCount > 0 ? 'white' : 'var(--text-2)',
              border: '1px solid var(--border)',
            }}
          >
            ⚙ Bộ lọc{advancedFilterCount > 0 ? ` ${advancedFilterCount}` : ''}
          </button>

          {/* Desktop: filter phụ dạng dropdown/popover (Sprint 6) */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                onClick={() => setOpenDesktopFilter(d => d === 'difficulty' ? null : 'difficulty')}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: selectedDifficulties.length > 0 ? 'var(--brand-light)' : 'var(--surface)',
                  color: selectedDifficulties.length > 0 ? 'var(--brand-dark)' : 'var(--text-2)',
                  border: '1px solid var(--border)',
                }}
              >
                Độ khó ▾
              </button>
              {openDesktopFilter === 'difficulty' && (
                <div className="absolute top-full left-0 mt-2 z-50 w-56 rounded-2xl p-3"
                  style={{ background: 'var(--surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid var(--border)' }}>
                  <FilterCheckboxList options={difficultyOptions} selected={selectedDifficulties} onToggle={v => toggleInArray(setSelectedDifficulties, v)} />
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setOpenDesktopFilter(d => d === 'equipment' ? null : 'equipment')}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: selectedEquipment.length > 0 ? 'var(--brand-light)' : 'var(--surface)',
                  color: selectedEquipment.length > 0 ? 'var(--brand-dark)' : 'var(--text-2)',
                  border: '1px solid var(--border)',
                }}
              >
                Dụng cụ ▾
              </button>
              {openDesktopFilter === 'equipment' && (
                <div className="absolute top-full left-0 mt-2 z-50 w-56 max-h-72 overflow-y-auto rounded-2xl p-3"
                  style={{ background: 'var(--surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid var(--border)' }}>
                  <FilterCheckboxList options={equipmentOptions} selected={selectedEquipment} onToggle={v => toggleInArray(setSelectedEquipment, v)} />
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setOpenDesktopFilter(d => d === 'movementPattern' ? null : 'movementPattern')}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: selectedMovementPatterns.length > 0 ? 'var(--brand-light)' : 'var(--surface)',
                  color: selectedMovementPatterns.length > 0 ? 'var(--brand-dark)' : 'var(--text-2)',
                  border: '1px solid var(--border)',
                }}
              >
                Kiểu vận động ▾
              </button>
              {openDesktopFilter === 'movementPattern' && (
                <div className="absolute top-full left-0 mt-2 z-50 w-56 max-h-72 overflow-y-auto rounded-2xl p-3"
                  style={{ background: 'var(--surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid var(--border)' }}>
                  <FilterCheckboxList options={movementPatternOptions} selected={selectedMovementPatterns} onToggle={v => toggleInArray(setSelectedMovementPatterns, v)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sprint 6: Active Filters — chỉ hiện khi có ít nhất 1 filter phụ */}
        {advancedFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedDifficulties.map(v => (
              <FilterChip key={`diff-${v}`} label={v} onRemove={() => removeActiveFilter('difficulty', v)} />
            ))}
            {selectedEquipment.map(v => (
              <FilterChip key={`eq-${v}`} label={v} onRemove={() => removeActiveFilter('equipment', v)} />
            ))}
            {selectedMovementPatterns.map(v => (
              <FilterChip key={`mp-${v}`} label={v} onRemove={() => removeActiveFilter('movementPattern', v)} />
            ))}
            <button onClick={clearAppliedFilters} className="text-xs font-semibold ml-auto shrink-0" style={{ color: 'var(--brand)' }}>
              Xóa tất cả
            </button>
          </div>
        )}

        {/* Toggle archived */}
        <button onClick={() => setShowArchived(s => !s)}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl"
          style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
          <span>{showArchived ? '☑' : '☐'}</span>
          Hiện đã lưu trữ
        </button>

        {/* List */}
        {loading && <p className="text-center py-8 text-sm" style={{ color: 'var(--text-3)' }}>Đang tải...</p>}

        {/* Sprint 6: Empty State — phân biệt Filter empty vs Search empty */}
        {isEmpty && hasAdvancedFilter && (
          <div className="card p-8 text-center space-y-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Không có bài tập phù hợp</p>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Không có bài tập {filterSummaryText}.
            </p>
            <button onClick={clearAppliedFilters} className="btn-primary py-2.5 text-sm" style={{ display: 'inline-block', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
              Xóa bộ lọc
            </button>
          </div>
        )}

        {isEmpty && !hasAdvancedFilter && hasSearch && (
          <div className="card p-8 text-center space-y-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Không tìm thấy bài tập</p>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Thử tìm bằng tên bài tập, nhóm cơ hoặc hướng dẫn kỹ thuật.
            </p>
            <button onClick={() => setSearch('')} className="btn-primary py-2.5 text-sm" style={{ display: 'inline-block', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
              Xóa tìm kiếm
            </button>
          </div>
        )}

        {isEmpty && !hasAdvancedFilter && !hasSearch && (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Không tìm thấy bài tập nào.</p>
          </div>
        )}

        {/* Sprint 6: desktop chuyển grid 3 cột, mobile giữ list dọc */}
        <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-3 md:gap-3">
          {displayed.map(ex => {
            const isArchived = !!ex.archived_at
            return (
              <button key={ex.id}
                onClick={() => router.push(`/exercises/${ex.id}`)}
                className="card w-full p-4 flex items-center justify-between text-left transition-all"
                style={{ opacity: isArchived ? 0.5 : 1 }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{ex.name}</p>
                    {isArchived && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                        Đã lưu trữ
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{ex.muscle_group}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ex.difficulty && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
                      {ex.difficulty}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-3)' }}>›</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sprint 6: backdrop đóng dropdown desktop khi click ra ngoài */}
      {openDesktopFilter && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDesktopFilter(null)} />
      )}

      {/* Sprint 6: Mobile Bottom Sheet — draft/applied tách biệt */}
      {showFilterSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={e => { if (e.target === e.currentTarget) closeFilterSheetWithoutApply() }}>
          <div className="slide-up rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'var(--border-strong)' }} />

            <div className="flex items-center justify-between">
              <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>Bộ lọc</p>
              <button onClick={closeFilterSheetWithoutApply} style={{ color: 'var(--text-3)' }}>✕</button>
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>DỤNG CỤ</p>
              <FilterCheckboxList options={equipmentOptions} selected={draftEquipment} onToggle={v => toggleInArray(setDraftEquipment, v)} />
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>ĐỘ KHÓ</p>
              <FilterCheckboxList options={difficultyOptions} selected={draftDifficulties} onToggle={v => toggleInArray(setDraftDifficulties, v)} />
            </div>

            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-3)' }}>KIỂU VẬN ĐỘNG</p>
              <FilterCheckboxList options={movementPatternOptions} selected={draftMovementPatterns} onToggle={v => toggleInArray(setDraftMovementPatterns, v)} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={clearDraftFilters} className="btn-ghost">Xóa tất cả</button>
              <button onClick={applyFilterSheet} className="flex-1 btn-primary">
                Xem {draftMatchCount} bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
