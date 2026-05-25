import { HOUR_START, PX_PER_HOUR } from "@/hooks/useGrid"
import type { ApiEvent } from "@/types"

interface EventBlockProps {
  event: ApiEvent
  onClick: () => void
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export default function EventBlock({ event, onClick }: EventBlockProps) {
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)

  const minutesFromStart = (start.getHours() - HOUR_START) * 60 + start.getMinutes()
  const durationMinutes = Math.max(15, (end.getTime() - start.getTime()) / 60_000)

  const top = minutesFromStart * (PX_PER_HOUR / 60)
  const height = Math.max(24, durationMinutes * (PX_PER_HOUR / 60))

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
          <p className="text-[10px] text-smoke-300 truncate">
            {formatTime(start)} – {formatTime(end)}
          </p>
        )}
      </div>
    </button>
  )
}
