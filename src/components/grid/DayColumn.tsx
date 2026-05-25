"use client"

import { useDroppable } from "@dnd-kit/core"
import { HOUR_START, PX_PER_HOUR } from "@/hooks/useGrid"
import type { ApiEvent } from "@/types"
import EventBlock from "../events/EventBlock"
import TimeSlot from "./TimeSlot"

interface DayColumnProps {
  date: Date
  hours: number[]
  events: ApiEvent[]
  isToday: boolean
  resizingEventId: string | null
  resizeDeltaMinutes: number
  onSlotClick: (hour: number) => void
  onEventClick: (ev: ApiEvent) => void
  onResizeStart: (eventId: string, clientY: number) => void
  onResizeMove: (eventId: string, clientY: number) => void
  onResizeEnd: (eventId: string) => void
}

export default function DayColumn({
  date,
  hours,
  events,
  isToday,
  resizingEventId,
  resizeDeltaMinutes,
  onSlotClick,
  onEventClick,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: DayColumnProps) {
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  const { setNodeRef, isOver } = useDroppable({ id: dateStr })

  const now = new Date()
  const minutesFromStart = isToday
    ? (now.getHours() - HOUR_START) * 60 + now.getMinutes()
    : -1
  const lineTop = minutesFromStart >= 0 ? minutesFromStart * (PX_PER_HOUR / 60) : -1

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 border-l border-smoke-700 min-w-0 relative transition-colors ${
        isToday ? "bg-navy-900/20" : ""
      } ${isOver ? "bg-navy-800/30" : ""}`}
    >
      {hours.map((hour) => (
        <TimeSlot key={hour} hour={hour} onClick={() => onSlotClick(hour)} />
      ))}

      {lineTop >= 0 && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: lineTop }}
        >
          <div className="relative">
            <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-doom-gold" />
            <div className="h-px bg-doom-gold/60 ml-1" />
          </div>
        </div>
      )}

      {events.map((ev) => (
        <EventBlock
          key={ev.id}
          event={ev}
          resizeDeltaMinutes={resizingEventId === ev.id ? resizeDeltaMinutes : 0}
          onClick={() => onEventClick(ev)}
          onResizeStart={(clientY) => onResizeStart(ev.id, clientY)}
          onResizeMove={(clientY) => onResizeMove(ev.id, clientY)}
          onResizeEnd={() => onResizeEnd(ev.id)}
        />
      ))}
    </div>
  )
}
