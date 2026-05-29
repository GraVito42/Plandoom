"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft } from "lucide-react"
import { getMonday } from "@/hooks/useGrid"
import type { ApiChip } from "@/types"
import ChipArea from "./ChipArea"
import FolderSetup from "@/components/folders/FolderSetup"

interface WeeklySidebarProps {
  onCollapse?: () => void
}

export default function WeeklySidebar({ onCollapse }: WeeklySidebarProps = {}) {
  const weekStart = getMonday(new Date())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { weekNumber, year } = getISOWeek(weekStart)

  const [folderSetupOpen, setFolderSetupOpen] = useState(false)

  const { data: chips = [] } = useQuery<ApiChip[]>({
    queryKey: ["chips", "weekly", weekStart.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/chips?area=weekly&weekStart=${weekStart.toISOString()}&weekEnd=${weekEnd.toISOString()}`
      )
      if (!res.ok) throw new Error("Failed to load chips")
      return res.json() as Promise<ApiChip[]>
    },
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-smoke-800 shrink-0 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-smoke-300 uppercase tracking-widest">
          Weekly Notes
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFolderSetupOpen(true)}
            className="text-[10px] text-smoke-500 hover:text-doom-gold border border-smoke-700 hover:border-doom-gold/40 rounded px-1.5 py-0.5 transition-colors"
            title="New folder"
          >
            + Folder
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="text-smoke-500 hover:text-smoke-200 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <ChipArea
          area="weekly"
          chips={chips}
          draggable
          weekNumber={weekNumber}
          year={year}
        />
      </div>

      {folderSetupOpen && (
        <FolderSetup onClose={() => setFolderSetupOpen(false)} />
      )}
    </div>
  )
}

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
