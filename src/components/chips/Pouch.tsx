"use client"

import { useQuery } from "@tanstack/react-query"
import { getMonday } from "@/hooks/useGrid"
import type { ApiChip } from "@/types"
import ChipArea from "./ChipArea"

function getISOWeek(date: Date): { weekNumber: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return {
    weekNumber: Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
    year: d.getUTCFullYear(),
  }
}

function chipWeekKey(chip: ApiChip): { weekNumber: number; year: number } | null {
  if (chip.area === "daily" && chip.dayTarget) {
    return getISOWeek(new Date(chip.dayTarget))
  }
  if (chip.area === "weekly" && chip.weekNumber != null && chip.year != null) {
    return { weekNumber: chip.weekNumber, year: chip.year }
  }
  return null
}

interface PouchProps {
  onClose: () => void
  onSchedule: (chip: ApiChip) => void
}

export default function Pouch({ onClose, onSchedule }: PouchProps) {
  const weekStart = getMonday(new Date())
  const { weekNumber, year } = getISOWeek(weekStart)

  const { data: chips = [] } = useQuery<ApiChip[]>({
    queryKey: ["chips", "pouch", weekNumber, year],
    queryFn: async () => {
      const params = new URLSearchParams({
        view: "pouch",
        weekStart: weekStart.toISOString(),
        weekNumber: String(weekNumber),
        year: String(year),
      })
      const res = await fetch(`/api/chips?${params}`)
      if (!res.ok) throw new Error("Failed to load pouch")
      return res.json() as Promise<ApiChip[]>
    },
  })

  // Group chips by (year, weekNumber), most recent first
  const groupMap = new Map<string, { weekNumber: number; year: number; chips: ApiChip[] }>()
  for (const chip of chips) {
    const key = chipWeekKey(chip)
    if (!key) continue
    const k = `${key.year}-${key.weekNumber}`
    if (!groupMap.has(k)) groupMap.set(k, { weekNumber: key.weekNumber, year: key.year, chips: [] })
    groupMap.get(k)!.chips.push(chip)
  }
  const groups = [...groupMap.values()].sort(
    (a, b) => b.year - a.year || b.weekNumber - a.weekNumber
  )

  return (
    <div className="absolute top-0 right-0 bottom-0 w-56 z-30 flex flex-col bg-smoke-900 border-l border-smoke-700 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-smoke-700 shrink-0">
        <span className="text-xs font-semibold text-smoke-300 uppercase tracking-widest">
          Pouch
        </span>
        <button
          onClick={onClose}
          className="text-smoke-500 hover:text-smoke-200 transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>

      {/* Grouped chip list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {groups.length === 0 ? (
          <p className="text-xs text-smoke-600 italic">No past unscheduled chips.</p>
        ) : (
          groups.map((group) => (
            <div key={`${group.year}-${group.weekNumber}`} className="flex flex-col gap-1.5">
              <span className="text-[10px] text-smoke-500 uppercase tracking-widest border-b border-smoke-800 pb-1">
                Week {group.weekNumber} · {group.year}
              </span>
              <ChipArea
                area="pouch"
                chips={group.chips}
                draggable
                onSchedule={onSchedule}
                hideAddButton
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
