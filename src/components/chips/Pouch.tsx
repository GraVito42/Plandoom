"use client"

import { useQuery } from "@tanstack/react-query"
import type { ApiChip } from "@/types"
import ChipArea from "./ChipArea"

interface PouchProps {
  onClose: () => void
  onSchedule: (chip: ApiChip) => void
}

export default function Pouch({ onClose, onSchedule }: PouchProps) {
  const { data: chips = [] } = useQuery<ApiChip[]>({
    queryKey: ["chips", "pouch"],
    queryFn: async () => {
      const res = await fetch("/api/chips?area=pouch")
      if (!res.ok) throw new Error("Failed to load pouch")
      return res.json()
    },
  })

  const pouchChips = chips.filter((c) => c.area === "pouch")
  const pastWeekChips = chips.filter((c) => c.area !== "pouch")

  // Group past-week chips by "year-WW" key, sorted descending (most recent first)
  const pastWeekGroups: Array<{ key: string; label: string; chips: ApiChip[] }> = []
  const groupMap = new Map<string, ApiChip[]>()
  for (const chip of pastWeekChips) {
    const year = chip.year ?? 0
    const week = chip.weekNumber ?? 0
    const key = `${year}-${String(week).padStart(2, "0")}`
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(chip)
  }
  const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => b.localeCompare(a))
  for (const key of sortedKeys) {
    const [yearStr, weekStr] = key.split("-")
    pastWeekGroups.push({
      key,
      label: `W${parseInt(weekStr, 10)} · ${yearStr}`,
      chips: groupMap.get(key)!,
    })
  }

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

      {/* Chip list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">

        {/* Current pouch section */}
        <div>
          {pouchChips.length === 0 && pastWeekGroups.length === 0 && (
            <p className="text-xs text-smoke-600 italic">No chips in the pouch.</p>
          )}
          <ChipArea
            area="pouch"
            chips={pouchChips}
            draggable
            onSchedule={onSchedule}
          />
        </div>

        {/* Past weeks section */}
        {pastWeekGroups.length > 0 && (
          <>
            {/* Divider */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex-1 h-px bg-smoke-700" />
              <span className="text-[9px] text-smoke-600 uppercase tracking-widest shrink-0">Settimane passate</span>
              <div className="flex-1 h-px bg-smoke-700" />
            </div>

            {pastWeekGroups.map((group) => (
              <div key={group.key} className="flex flex-col gap-1.5">
                {/* Week badge */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-semibold text-doom-gold/70 bg-doom-gold/10 border border-doom-gold/20 rounded px-1.5 py-0.5 leading-none">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-smoke-800" />
                </div>

                <ChipArea
                  area="pouch"
                  chips={group.chips}
                  draggable
                  onSchedule={onSchedule}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
