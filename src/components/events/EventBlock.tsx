import { ORA_INIZIO, PX_PER_ORA } from "@/hooks/useGrid"
import type { ApiEvent } from "@/types"

interface EventBlockProps {
  event: ApiEvent
  onClick: () => void
}

// Formatta ora:minuti in formato HH:MM
function formatOra(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export default function EventBlock({ event, onClick }: EventBlockProps) {
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)

  // Posizionamento verticale rispetto all'ORA_INIZIO della griglia
  const minutiDallInizio = (start.getHours() - ORA_INIZIO) * 60 + start.getMinutes()
  const durataMinuti = Math.max(15, (end.getTime() - start.getTime()) / 60_000)

  const top = minutiDallInizio * (PX_PER_ORA / 60)
  const height = Math.max(24, durataMinuti * (PX_PER_ORA / 60))

  return (
    <button
      onClick={onClick}
      className="absolute left-0.5 right-0.5 z-20 text-left rounded overflow-hidden focus:outline-none focus:ring-1 focus:ring-doom-gold"
      style={{ top, height }}
    >
      <div className="h-full bg-navy-600 border-l-2 border-doom-gold/70 rounded px-1.5 py-0.5 hover:bg-navy-500 transition-colors">
        <p className="text-xs font-medium text-smoke-100 truncate leading-tight">
          {event.title}
        </p>
        {height > 32 && (
          <p className="text-[10px] text-smoke-400 truncate">
            {formatOra(start)} – {formatOra(end)}
          </p>
        )}
      </div>
    </button>
  )
}
