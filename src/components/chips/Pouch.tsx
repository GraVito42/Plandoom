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
      <div className="flex-1 overflow-y-auto p-3">
        {chips.length === 0 ? (
          <p className="text-xs text-smoke-600 italic">No chips in the pouch.</p>
        ) : null}
        <ChipArea
          area="pouch"
          chips={chips}
          draggable={false}
          onSchedule={onSchedule}
        />
      </div>
    </div>
  )
}
