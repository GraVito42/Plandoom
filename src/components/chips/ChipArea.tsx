"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { ApiChip, ChipArea as ChipAreaType } from "@/types"
import Chip from "./Chip"

interface ChipAreaProps {
  area: ChipAreaType
  chips: ApiChip[]
  draggable?: boolean
  dayTarget?: string   // ISO string — required when area='daily'
  weekNumber?: number  // required when area='weekly'
  year?: number
  onSchedule?: (chip: ApiChip) => void
}

export default function ChipArea({
  area,
  chips,
  draggable = false,
  dayTarget,
  weekNumber,
  year,
  onSchedule,
}: ChipAreaProps) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState("")

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return

    await fetch("/api/chips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        area,
        dayTarget,
        weekNumber,
        year,
      }),
    })

    setNewTitle("")
    setAdding(false)
    await queryClient.invalidateQueries({ queryKey: ["chips"] })
  }

  async function handleDelete(id: string) {
    await fetch(`/api/chips/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["chips"] })
  }

  return (
    <div className="flex flex-col gap-1">
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          chip={chip}
          draggable={draggable}
          onSchedule={onSchedule}
          onDelete={handleDelete}
        />
      ))}

      {adding ? (
        <form onSubmit={handleAdd} className="flex gap-1">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={() => { if (!newTitle.trim()) setAdding(false) }}
            onKeyDown={(e) => { if (e.key === "Escape") { setAdding(false); setNewTitle("") } }}
            placeholder="Chip title..."
            className="flex-1 min-w-0 bg-navy-900 border border-doom-gold/50 rounded px-2 py-1 text-xs text-smoke-100 placeholder-smoke-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="text-xs text-doom-gold hover:text-doom-gold/80 disabled:opacity-30 transition-colors"
          >
            ✓
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="self-start text-[10px] text-smoke-600 hover:text-smoke-400 transition-colors"
        >
          + Add chip
        </button>
      )}
    </div>
  )
}
