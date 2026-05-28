"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useDndMonitor, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core"
import { HOUR_START, HOUR_END, PX_PER_HOUR } from "./useGrid"
import type { ApiEvent } from "@/types"

function snap15(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

export function useDragDrop(events: ApiEvent[]) {
  const queryClient = useQueryClient()
  const [activeEvent, setActiveEvent] = useState<ApiEvent | null>(null)
  const [activeChip, setActiveChip] = useState<{ title: string } | null>(null)
  const [activeDims, setActiveDims] = useState<{ width: number; height: number } | null>(null)

  useDndMonitor({
    onDragStart({ active }: DragStartEvent) {
      const id = active.id as string
      const data = active.data.current as { type: string; title?: string } | undefined
      if (data?.type === "event") {
        setActiveEvent(events.find((e) => e.id === id) ?? null)
        setActiveChip(null)
      } else if (data?.type === "chip") {
        setActiveChip({ title: data.title ?? "" })
        setActiveEvent(null)
      }
      const rect = active.rect.current.initial
      if (rect) setActiveDims({ width: rect.width, height: rect.height })
    },

    async onDragEnd({ active, over, delta }: DragEndEvent) {
      setActiveEvent(null)
      setActiveChip(null)
      setActiveDims(null)
      if (!over) return

      const overId = over.id as string
      const data = active.data.current as {
        type: string
        chipId?: string
        duration?: number | null
      } | undefined

      // "chip-daily-*" drops are handled by ChipArea's own monitor
      if (overId.startsWith("chip-daily-")) return

      if (data?.type === "event") {
        const eventId = active.id as string
        const event = events.find((e) => e.id === eventId)
        if (!event) return

        const originalStart = new Date(event.startTime)
        const originalEnd = new Date(event.endTime)
        const durationMs = originalEnd.getTime() - originalStart.getTime()
        const [year, month, day] = overId.split("-").map(Number)
        const deltaMinutes = snap15(delta.y / (PX_PER_HOUR / 60))

        const newStart = new Date(originalStart)
        newStart.setFullYear(year, month - 1, day)
        newStart.setMinutes(newStart.getMinutes() + deltaMinutes)
        const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0)
        const dayLast  = new Date(year, month - 1, day, 23, 45, 0, 0)
        if (newStart < dayStart) newStart.setTime(dayStart.getTime())
        if (newStart > dayLast)  newStart.setTime(dayLast.getTime())
        const newEnd = new Date(newStart.getTime() + durationMs)

        await fetch(`/api/events/${eventId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startTime: newStart.toISOString(), endTime: newEnd.toISOString() }),
        })
        await queryClient.invalidateQueries({ queryKey: ["events"] })

      } else if (data?.type === "chip") {
        // Chip dropped on time grid → convert to event using chip.duration
        const chipId = data.chipId!
        const [year, month, day] = overId.split("-").map(Number)
        const dropTop = active.rect.current.translated?.top ?? 0
        const columnTop = over.rect.top
        const offsetInColumn = Math.max(0, dropTop - columnTop)
        const hour = Math.max(
          HOUR_START,
          Math.min(HOUR_END - 1, HOUR_START + Math.floor(offsetInColumn / PX_PER_HOUR))
        )
        const durationMin = data.duration ?? 60
        const startDate = new Date(year, month - 1, day, hour, 0, 0, 0)
        const endDate   = new Date(startDate.getTime() + durationMin * 60_000)

        await fetch(`/api/chips/${chipId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startTime: startDate.toISOString(), endTime: endDate.toISOString() }),
        })
        await queryClient.invalidateQueries({ queryKey: ["events"] })
        await queryClient.invalidateQueries({ queryKey: ["chips"] })
      }
    },

    onDragCancel() {
      setActiveEvent(null)
      setActiveChip(null)
      setActiveDims(null)
    },
  })

  return { activeEvent, activeChip, activeDims }
}
