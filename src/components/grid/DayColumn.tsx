import { HOUR_START, PX_PER_HOUR } from "@/hooks/useGrid"
import type { ApiEvent } from "@/types"
import EventBlock from "../events/EventBlock"
import TimeSlot from "./TimeSlot"

interface DayColumnProps {
  date: Date
  hours: number[]
  events: ApiEvent[]
  isToday: boolean
  onSlotClick: (hour: number) => void
  onEventClick: (ev: ApiEvent) => void
}

export default function DayColumn({
  date,
  hours,
  events,
  isToday,
  onSlotClick,
  onEventClick,
}: DayColumnProps) {
  const now = new Date()
  const minutesFromStart = isToday
    ? (now.getHours() - HOUR_START) * 60 + now.getMinutes()
    : -1
  const lineTop =
    minutesFromStart >= 0 ? minutesFromStart * (PX_PER_HOUR / 60) : -1

  return (
    <div
      className={`flex-1 border-l border-smoke-700 min-w-0 relative ${
        isToday ? "bg-navy-900/20" : ""
      }`}
    >
      {/* Clickable hour slots */}
      {hours.map((hour) => (
        <TimeSlot key={hour} hour={hour} onClick={() => onSlotClick(hour)} />
      ))}

      {/* Current time indicator */}
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

      {/* Event blocks */}
      {events.map((ev) => (
        <EventBlock key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
      ))}
    </div>
  )
}
