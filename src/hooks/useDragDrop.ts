"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useDndMonitor, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core"
import { HOUR_START, HOUR_END, PX_PER_HOUR } from "./useGrid"
import type { ApiEvent } from "@/types"

function snap15(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

function extractChipStyle(visualStyle: unknown): {
  shape: string; frameColor: string; frameWidth: number
  sideColor: string; sideWidth: number
  fillColor: string; fillOpacity: number; textColor: string
} {
  const vs = visualStyle as Record<string, unknown> | null | undefined
  return {
    shape: typeof vs?.shape === "string" ? vs.shape : "rounded",
    frameColor: typeof vs?.frameColor === "string" ? vs.frameColor : "transparent",
    frameWidth: typeof vs?.frameWidth === "number" ? vs.frameWidth : 1,
    sideColor: typeof vs?.sideColor === "string" ? vs.sideColor : "#c9a84c",
    sideWidth: typeof vs?.sideWidth === "number" ? vs.sideWidth : 2,
    fillColor: typeof vs?.fillColor === "string" ? vs.fillColor : "#162d5e",
    fillOpacity: typeof vs?.fillOpacity === "number" ? vs.fillOpacity : 100,
    textColor: typeof vs?.textColor === "string" ? vs.textColor : "#d1d5db",
  }
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

      // Chip → chip area: handled by ChipArea's own monitor
      if (data?.type === "chip" && (overId.startsWith("chip-daily-") || overId.startsWith("chip-weekly-"))) return

      // Event → daily chip area: convert event to chip
      if (data?.type === "event" && overId.startsWith("chip-daily-")) {
        const eventId = active.id as string
        const event = events.find((e) => e.id === eventId)
        if (!event) return
        const dateStr = overId.slice("chip-daily-".length)
        const [year, month, day] = dateStr.split("-").map(Number)
        const dayTarget = new Date(year, month - 1, day, 12, 0, 0, 0).toISOString()
        const durationMin = Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000)
        const { shape, frameColor, frameWidth, sideColor, sideWidth, fillColor, fillOpacity, textColor } = extractChipStyle(event.visualStyle)
        await fetch("/api/chips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: event.title,
            ...(event.description && { description: event.description }),
            area: "daily",
            dayTarget,
            duration: durationMin,
            ...(event.folderId && { folderId: event.folderId }),
            ...(event.location && { location: event.location }),
            ...(event.locationUrl && { locationUrl: event.locationUrl }),
            visualStyle: {
              shape, frameColor, frameWidth,
              sideColor, sideWidth,
              fillColor, fillOpacity,
              textColor, eventType: "default",
              fontFamily: "inherit", hasCheckbox: false, isChecked: false,
            },
          }),
        })
        await fetch(`/api/events/${eventId}`, { method: "DELETE" })
        await queryClient.invalidateQueries({ queryKey: ["events"] })
        await queryClient.invalidateQueries({ queryKey: ["chips"] })
        return
      }

      // Event → weekly chip area: convert event to chip
      if (data?.type === "event" && overId.startsWith("chip-weekly-")) {
        const eventId = active.id as string
        const event = events.find((e) => e.id === eventId)
        if (!event) return
        const parts = overId.slice("chip-weekly-".length).split("-")
        const chipYear = Number(parts[0])
        const chipWeekNumber = Number(parts[1])
        const durationMin = Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000)
        const { shape, frameColor, frameWidth, sideColor, sideWidth, fillColor, fillOpacity, textColor } = extractChipStyle(event.visualStyle)
        await fetch("/api/chips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: event.title,
            ...(event.description && { description: event.description }),
            area: "weekly",
            weekNumber: chipWeekNumber,
            year: chipYear,
            duration: durationMin,
            ...(event.folderId && { folderId: event.folderId }),
            ...(event.location && { location: event.location }),
            ...(event.locationUrl && { locationUrl: event.locationUrl }),
            visualStyle: {
              shape, frameColor, frameWidth,
              sideColor, sideWidth,
              fillColor, fillOpacity,
              textColor, eventType: "default",
              fontFamily: "inherit", hasCheckbox: false, isChecked: false,
            },
          }),
        })
        await fetch(`/api/events/${eventId}`, { method: "DELETE" })
        await queryClient.invalidateQueries({ queryKey: ["events"] })
        await queryClient.invalidateQueries({ queryKey: ["chips"] })
        return
      }

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
        const initialTop = active.rect.current.initial?.top ?? 0
        const dropTop = active.rect.current.translated?.top ?? (initialTop + delta.y)
        const columnTop = over.rect.top
        const offsetInColumn = Math.max(0, dropTop - columnTop)
        const minutesFromTop = snap15(offsetInColumn / (PX_PER_HOUR / 60))
        const totalMinutes = Math.max(HOUR_START * 60, Math.min((HOUR_END - 1) * 60 + 45, HOUR_START * 60 + minutesFromTop))
        const hour = Math.floor(totalMinutes / 60)
        const minute = totalMinutes % 60
        const durationMin = data.duration ?? 60
        const startDate = new Date(year, month - 1, day, hour, minute, 0, 0)
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
