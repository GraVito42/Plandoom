"use client"

import { useDraggable } from "@dnd-kit/core"
import type { ApiChip } from "@/types"

interface ChipProps {
  chip: ApiChip
  draggable?: boolean
  onSchedule?: (chip: ApiChip) => void
  onDelete?: (id: string) => void
}

export default function Chip({ chip, draggable = false, onSchedule, onDelete }: ChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${chip.id}`,
    data: { type: "chip", chipId: chip.id, title: chip.title },
    disabled: !draggable,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`group flex items-start gap-1.5 px-2 py-1.5 rounded-md border transition-all ${
        isDragging
          ? "opacity-30 border-doom-gold/40 bg-navy-800"
          : "border-smoke-700 bg-navy-900/60 hover:border-smoke-600 hover:bg-navy-800/60"
      }`}
      style={{ cursor: draggable ? "grab" : "default" }}
    >
      {/* Drag handle (only when draggable) */}
      {draggable && (
        <div
          {...listeners}
          className="mt-0.5 flex flex-col gap-0.5 shrink-0 opacity-40 group-hover:opacity-70 cursor-grab"
        >
          <div className="w-2.5 h-px bg-smoke-400" />
          <div className="w-2.5 h-px bg-smoke-400" />
          <div className="w-2.5 h-px bg-smoke-400" />
        </div>
      )}

      {/* Title */}
      <span className="flex-1 text-xs text-smoke-200 leading-tight min-w-0 truncate">
        {chip.title}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSchedule && (
          <button
            onClick={() => onSchedule(chip)}
            className="text-[10px] text-doom-gold hover:text-doom-gold/80 transition-colors"
            title="Schedule"
          >
            ⊕
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(chip.id)}
            className="text-[10px] text-smoke-500 hover:text-doom-ember transition-colors"
            title="Delete"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
