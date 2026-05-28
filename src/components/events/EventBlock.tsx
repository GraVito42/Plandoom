"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useDraggable } from "@dnd-kit/core"
import { HOUR_START, PX_PER_HOUR } from "@/hooks/useGrid"
import type { ApiEvent, VisualStyle } from "@/types"

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

function parseVisualStyle(raw: unknown): VisualStyle {
  const defaults: VisualStyle = {
    shape: "rounded",
    frameColor: "transparent",
    frameWidth: 1,
    sideColor: "#c9a84c",
    sideWidth: 2,
    fillColor: "#162d5e",
    textColor: "#d1d5db",
    fontFamily: "inherit",
    hasCheckbox: false,
    isChecked: false,
    eventType: "default",
    widthPercent: 100,
    leftOffset: 0,
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults
  const r = raw as Record<string, unknown>
  return {
    shape: (["rectangle", "rounded", "pill"].includes(r.shape as string)
      ? r.shape
      : defaults.shape) as VisualStyle["shape"],
    frameColor: typeof r.frameColor === "string" ? r.frameColor : defaults.frameColor,
    frameWidth: typeof r.frameWidth === "number" ? r.frameWidth : defaults.frameWidth,
    sideColor: typeof r.sideColor === "string" ? r.sideColor : defaults.sideColor,
    sideWidth: typeof r.sideWidth === "number" ? r.sideWidth : defaults.sideWidth,
    fillColor: typeof r.fillColor === "string" ? r.fillColor : defaults.fillColor,
    textColor: typeof r.textColor === "string" ? r.textColor : defaults.textColor,
    fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : defaults.fontFamily,
    hasCheckbox: typeof r.hasCheckbox === "boolean" ? r.hasCheckbox : defaults.hasCheckbox,
    isChecked: typeof r.isChecked === "boolean" ? r.isChecked : defaults.isChecked,
    eventType: typeof r.eventType === "string" ? r.eventType : defaults.eventType,
    widthPercent: typeof r.widthPercent === "number" ? Math.max(50, Math.min(100, r.widthPercent)) : defaults.widthPercent,
    leftOffset: typeof r.leftOffset === "number" ? Math.max(0, Math.min(50, r.leftOffset)) : defaults.leftOffset,
  }
}

function shapeRadius(shape: VisualStyle["shape"]): string {
  if (shape === "pill") return "9999px"
  if (shape === "rounded") return "4px"
  return "0"
}

export default function EventBlock({
  event,
  resizeDeltaMinutes,
  onClick,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: EventBlockProps) {
  const queryClient = useQueryClient()

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
  const height = Math.max(24, baseHeight + resizeDeltaMinutes * (PX_PER_HOUR / 60))

  const vs = parseVisualStyle(event.visualStyle)
  const leftOffsetPct = vs.leftOffset
  const widthPct = vs.widthPercent
  const radius = shapeRadius(vs.shape)

  const hasFrame = vs.frameWidth > 0 && vs.frameColor !== "transparent"
  const hasSide = vs.sideWidth > 0 && vs.sideColor !== "transparent"
  const fw = hasFrame ? vs.frameWidth : 0
  const fc = hasFrame ? vs.frameColor : "transparent"

  // Frame covers all four sides uniformly — side accent is a separate inner div
  const frameStyle: React.CSSProperties = {
    borderTopWidth: fw, borderTopStyle: hasFrame ? "solid" : "none", borderTopColor: fc,
    borderRightWidth: fw, borderRightStyle: hasFrame ? "solid" : "none", borderRightColor: fc,
    borderBottomWidth: fw, borderBottomStyle: hasFrame ? "solid" : "none", borderBottomColor: fc,
    borderLeftWidth: fw, borderLeftStyle: hasFrame ? "solid" : "none", borderLeftColor: fc,
  }

  // Content left padding accounts for the inner side stripe
  const contentPaddingLeft = hasSide
    ? vs.sideWidth + 4
    : hasFrame
    ? fw + 4
    : 6

  // Height thresholds for secondary info rows (title ~15px + py-1 ~4px overhead)
  const showLocation = !!event.location && height >= 34
  const showTime = height >= (showLocation ? 50 : 34)

  async function handleCheckboxToggle(e: React.MouseEvent) {
    e.stopPropagation()
    const newStyle: VisualStyle = { ...vs, isChecked: !vs.isChecked }
    await fetch(`/api/events/${event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visualStyle: newStyle }),
    })
    queryClient.invalidateQueries({ queryKey: ["events"] })
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className="absolute z-20"
      style={{
        top,
        height,
        left: `calc(${leftOffsetPct}% + 2px)`,
        width: `calc(${widthPct - leftOffsetPct}% - 4px)`,
        opacity: isDragging ? 0.25 : 1,
      }}
    >
      {/* Event body: frame border + fill + draggable */}
      <div
        {...listeners}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        className="relative h-full overflow-hidden hover:brightness-110 transition-all cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-doom-gold/50 select-none"
        style={{
          backgroundColor: vs.fillColor,
          borderRadius: radius,
          ...frameStyle,
        }}
      >
        {/* Side accent — absolute inner div, sits on top of fill, inside the frame */}
        {hasSide && (
          <div
            className="absolute left-0 top-0 bottom-0 pointer-events-none"
            style={{
              width: vs.sideWidth,
              backgroundColor: vs.sideColor,
              borderRadius: vs.shape !== "rectangle"
                ? `calc(${radius} - ${fw}px) 0 0 calc(${radius} - ${fw}px)`
                : 0,
            }}
          />
        )}

        {/* Content — padding scales with frame width and shape curvature */}
        <div
          className="h-full overflow-hidden"
          style={{
            paddingTop: Math.max(2, fw + 1),
            paddingBottom: Math.max(2, fw + 1),
            paddingRight: Math.max(4, fw + 2) + (vs.shape === "pill" ? 8 : 0),
            paddingLeft: hasSide
              ? vs.sideWidth + 4 + (vs.shape === "pill" ? 8 : 0)
              : Math.max(4, fw + 2) + (vs.shape === "pill" ? 8 : 0),
            color: vs.textColor,
            fontFamily: vs.fontFamily !== "inherit" ? vs.fontFamily : undefined,
          }}
        >
          {/* Title row */}
          <div className="flex items-center gap-1 min-w-0">
            {vs.hasCheckbox && (
              <button
                type="button"
                onClick={handleCheckboxToggle}
                className="shrink-0 text-[11px] leading-none hover:opacity-70 transition-opacity"
                style={{ color: vs.textColor }}
                title={vs.isChecked ? "Uncheck" : "Check"}
              >
                {vs.isChecked ? "☑" : "☐"}
              </button>
            )}
            <p
              className="text-xs font-medium truncate leading-tight min-w-0"
              style={{
                textDecoration: vs.hasCheckbox && vs.isChecked ? "line-through" : "none",
                opacity: vs.hasCheckbox && vs.isChecked ? 0.6 : 1,
              }}
            >
              {event.title}
            </p>
          </div>

          {/* Location */}
          {showLocation && (
            <p className="text-[10px] truncate leading-tight opacity-75 mt-0.5">
              📍 {event.location}
            </p>
          )}

          {/* Time range */}
          {showTime && (
            <p className="text-[10px] truncate leading-tight opacity-60 mt-0.5">
              {formatTime(start)} – {formatTime(end)}
            </p>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/10 transition-colors"
        style={{ borderRadius: `0 0 ${radius} ${radius}` }}
        onPointerDown={(e) => {
          e.stopPropagation()
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
