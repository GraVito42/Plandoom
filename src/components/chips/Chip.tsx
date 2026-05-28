"use client"

import { useDraggable } from "@dnd-kit/core"
import type { ApiChip, VisualStyle } from "@/types"

const UNIT_PX = 28  // 30 min = 28px

function shapeRadius(shape: VisualStyle["shape"]): string {
  if (shape === "pill") return "9999px"
  if (shape === "rounded") return "4px"
  return "0"
}

interface ChipProps {
  chip: ApiChip
  visualStyle: VisualStyle
  sizeUnits: number               // 1–4
  layout: "horizontal" | "vertical"
  draggable?: boolean
  onEdit?: () => void
  onSchedule?: (chip: ApiChip) => void
  onDelete?: (id: string) => void
}

export default function Chip({
  chip,
  visualStyle: vs,
  sizeUnits,
  layout,
  draggable = false,
  onEdit,
  onSchedule,
  onDelete,
}: ChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${chip.id}`,
    data: { type: "chip", chipId: chip.id, title: chip.title, duration: chip.duration },
    disabled: !draggable,
  })

  const hasFrame = vs.frameWidth > 0 && vs.frameColor !== "transparent"
  const hasSide  = vs.sideWidth > 0 && vs.sideColor !== "transparent"
  const radius   = shapeRadius(vs.shape)
  const fw       = hasFrame ? vs.frameWidth : 0
  const fc       = hasFrame ? vs.frameColor : "transparent"

  const sizeStyle: React.CSSProperties = layout === "horizontal"
    ? { flex: sizeUnits, minWidth: sizeUnits * UNIT_PX }
    : { minHeight: sizeUnits * UNIT_PX }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{
        ...sizeStyle,
        backgroundColor: vs.fillColor === "transparent" ? "transparent" : vs.fillColor,
        color: vs.textColor,
        borderRadius: radius,
        borderWidth: fw,
        borderStyle: hasFrame ? "solid" : "none",
        borderColor: fc,
        fontFamily: vs.fontFamily !== "inherit" ? vs.fontFamily : undefined,
        opacity: isDragging ? 0.3 : 1,
        position: "relative",
        overflow: "hidden",
      }}
      className="group transition-all"
    >
      {/* Side accent */}
      {hasSide && (
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none"
          style={{
            width: vs.sideWidth,
            backgroundColor: vs.sideColor,
            borderRadius: `calc(${radius} - ${fw}px) 0 0 calc(${radius} - ${fw}px)`,
          }}
        />
      )}

      {/* Body */}
      <div
        className="flex items-start gap-1 px-1.5 py-1"
        style={{ paddingLeft: hasSide ? vs.sideWidth + 6 : undefined }}
      >
        {/* Drag handle */}
        {draggable && (
          <div
            {...listeners}
            className="mt-0.5 flex flex-col gap-0.5 shrink-0 opacity-40 group-hover:opacity-70 cursor-grab"
          >
            <div className="w-2 h-px bg-current" />
            <div className="w-2 h-px bg-current" />
            <div className="w-2 h-px bg-current" />
          </div>
        )}

        {/* Title — click to edit */}
        <span
          className="flex-1 text-xs leading-tight min-w-0 truncate"
          style={{
            cursor: onEdit ? "pointer" : "default",
            color: vs.textColor,
          }}
          onClick={onEdit}
        >
          {chip.title}
        </span>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onSchedule && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSchedule(chip) }}
              className="text-[10px] leading-none hover:opacity-70 transition-opacity px-0.5"
              style={{ color: vs.textColor }}
              title="Schedule"
            >
              ⊕
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(chip.id) }}
              className="text-[10px] leading-none hover:opacity-70 transition-opacity px-0.5"
              style={{ color: vs.textColor }}
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
