"use client"

import { useDraggable } from "@dnd-kit/core"
import { HOUR_START, PX_PER_HOUR } from "@/hooks/useGrid"
import type { ApiEvent } from "@/types"

interface EventBlockProps {
  event: ApiEvent
  resizeDeltaMinutes: number
  onClick: () => void
  onResizeStart: (clientY: number) => void
  onResizeMove: (clientY: number) => void
  onResizeEnd: () => void
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export default function EventBlock({
  event,
  resizeDeltaMinutes,
  onClick,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: EventBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { type: "event" },
  })

  const start = new Date(event.startTime)
  const end = new Date(event.endTime)

  const minutesFromStart = (start.getHours() - HOUR_START) * 60 + start.getMinutes()
  const durationMinutes = Math.max(15, (end.getTime() - start.getTime()) / 60_000)

  const top = minutesFromStart * (PX_PER_HOUR / 60)
  const baseHeight = Math.max(24, durationMinutes * (PX_PER_HOUR / 60))
  // Apply live resize delta (clamped to minimum 24px / 15 min)
  const height = Math.max(24, baseHeight + resizeDeltaMinutes * (PX_PER_HOUR / 60))

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className="absolute left-0.5 right-0.5 z-20"
      style={{ top, height, opacity: isDragging ? 0.25 : 1 }}
    >
      {/* Draggable event body */}
      <div
        {...listeners}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        className="h-full bg-navy-600 border-l-2 border-doom-gold/70 rounded px-1.5 py-0.5 hover:bg-navy-500 transition-colors cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-doom-gold select-none"
      >
        <p className="text-xs font-medium text-smoke-100 truncate leading-tight">
          {event.title}
        </p>
        {height > 32 && (
          <p className="text-[10px] text-smoke-300 truncate">
            {formatTime(start)} – {formatTime(end)}
          </p>
        )}
      </div>

      {/* Resize handle — pointer capture keeps events flowing even outside the element */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize rounded-b hover:bg-doom-gold/30 transition-colors"
        onPointerDown={(e) => {
          e.stopPropagation() // prevent dnd-kit from starting a drag
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          onResizeStart(e.clientY)
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
          onResizeMove(e.clientY)
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          onResizeEnd()
        }}
      />
    </div>
  )
}
