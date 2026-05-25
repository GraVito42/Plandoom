import { ORA_INIZIO, PX_PER_ORA } from "@/hooks/useGrid"
import type { ApiEvent } from "@/types"
import EventBlock from "../events/EventBlock"
import TimeSlot from "./TimeSlot"

interface DayColumnProps {
  data: Date
  ore: number[]
  eventi: ApiEvent[]
  isOggi: boolean
  onSlotClick: (ora: number) => void
  onEventClick: (ev: ApiEvent) => void
}

export default function DayColumn({
  data,
  ore,
  eventi,
  isOggi,
  onSlotClick,
  onEventClick,
}: DayColumnProps) {
  // Posizione della linea ora corrente (solo per oggi)
  const now = new Date()
  const minutiDallInizio = isOggi
    ? (now.getHours() - ORA_INIZIO) * 60 + now.getMinutes()
    : -1
  const lineaTop =
    minutiDallInizio >= 0 ? minutiDallInizio * (PX_PER_ORA / 60) : -1

  return (
    <div
      className={`flex-1 border-l border-smoke-800 min-w-0 relative ${
        isOggi ? "bg-navy-900/20" : ""
      }`}
    >
      {/* Slot orari (sfondo cliccabile) */}
      {ore.map((ora) => (
        <TimeSlot key={ora} ora={ora} onClick={() => onSlotClick(ora)} />
      ))}

      {/* Linea ora corrente */}
      {lineaTop >= 0 && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: lineaTop }}
        >
          <div className="relative">
            <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-doom-gold" />
            <div className="h-px bg-doom-gold/60 ml-1" />
          </div>
        </div>
      )}

      {/* Blocchi evento */}
      {eventi.map((ev) => (
        <EventBlock key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
      ))}
    </div>
  )
}
