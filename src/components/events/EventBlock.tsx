"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useDraggable } from "@dnd-kit/core"
import { HOUR_START, PX_PER_HOUR } from "@/hooks/useGrid"
import type { ApiEvent, VisualStyle } from "@/types"
import { pathToPoints, smoothedPath } from "@/lib/shapeUtils"

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
    shapePath: null,
    shapeSmoothing: 0,
    textPosition: null,
    widthPercent: 100,
    leftOffset: 0,
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults
  const r = raw as Record<string, unknown>
  const tp = r.textPosition as { x: number; y: number } | null | undefined
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
    shapePath: typeof r.shapePath === "string" ? r.shapePath : null,
    shapeSmoothing: typeof r.shapeSmoothing === "number" ? r.shapeSmoothing : 0,
    textPosition: tp && typeof tp.x === "number" && typeof tp.y === "number" ? tp : null,
    widthPercent: typeof r.widthPercent === "number" ? r.widthPercent : 100,
    leftOffset: typeof r.leftOffset === "number" ? r.leftOffset : 0,
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
  const hasCustomShape = !!vs.shapePath
  const clipId = `clip-${event.id}`
  const radius = hasCustomShape ? "0" : shapeRadius(vs.shape)

  const hasFrame = vs.frameWidth > 0 && vs.frameColor !== "transparent"
  const hasSide = vs.sideWidth > 0 && vs.sideColor !== "transparent"
  const fw = hasFrame ? vs.frameWidth : 0
  const fc = hasFrame ? vs.frameColor : "transparent"

  // CSS frame — only used for standard (non-custom-shape) blocks
  const frameStyle: React.CSSProperties = hasCustomShape ? {} : {
    borderTopWidth: fw, borderTopStyle: hasFrame ? "solid" : "none", borderTopColor: fc,
    borderRightWidth: fw, borderRightStyle: hasFrame ? "solid" : "none", borderRightColor: fc,
    borderBottomWidth: fw, borderBottomStyle: hasFrame ? "solid" : "none", borderBottomColor: fc,
    borderLeftWidth: fw, borderLeftStyle: hasFrame ? "solid" : "none", borderLeftColor: fc,
  }

  // Height thresholds for secondary info rows
  const showLocation = !!event.location && height >= 34
  const showTime = height >= (showLocation ? 50 : 34)

  const widthPct = vs.widthPercent ?? 100
  const leftOffsetPct = vs.leftOffset ?? 0
  const textPos = hasCustomShape ? vs.textPosition : null

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
      {/* Clip-path definition for custom polygon shapes */}
      {hasCustomShape && (
        <svg width={0} height={0} style={{ display: "block" }}>
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <path d={smoothedPath(pathToPoints(vs.shapePath), vs.shapeSmoothing)} />
            </clipPath>
          </defs>
        </svg>
      )}

      {/* Event body: fill, content, draggable */}
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
          ...(hasCustomShape && { clipPath: `url(#${clipId})` }),
          ...frameStyle,
        }}
      >
        {/* Side accent */}
        {hasSide && (
          <div
            className="absolute left-0 top-0 bottom-0 pointer-events-none"
            style={{
              width: vs.sideWidth,
              backgroundColor: vs.sideColor,
              borderRadius: hasCustomShape || vs.shape === "rectangle"
                ? 0
                : `calc(${radius} - ${fw}px) 0 0 calc(${radius} - ${fw}px)`,
            }}
          />
        )}

        {/* Map pin — opens locationUrl in new tab, stops drag/click propagation */}
        {event.locationUrl && (
          <a
            href={event.locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-0.5 right-0.5 z-10 text-[9px] leading-none opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: vs.textColor }}
            title="Open in Maps"
          >
            📍
          </a>
        )}

        {/* Text at absolute position (custom shapes with textPosition) */}
        {textPos ? (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${textPos.x * 100}%`,
              top: `${textPos.y * 100}%`,
              transform: "translate(-50%, -50%)",
              maxWidth: "90%",
              textAlign: "center",
              color: vs.textColor,
              fontFamily: vs.fontFamily !== "inherit" ? vs.fontFamily : undefined,
            }}
          >
            <div className="flex items-center gap-1 justify-center min-w-0">
              {vs.hasCheckbox && (
                <button
                  type="button"
                  onClick={handleCheckboxToggle}
                  className="shrink-0 text-[11px] leading-none hover:opacity-70 transition-opacity pointer-events-auto"
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
            {showLocation && (
              <p className="text-[10px] truncate leading-tight opacity-75 mt-0.5">📍 {event.location}</p>
            )}
            {showTime && (
              <p className="text-[10px] truncate leading-tight opacity-60 mt-0.5">
                {formatTime(start)} – {formatTime(end)}
              </p>
            )}
          </div>
        ) : (
          /* Standard padding layout */
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
            {showLocation && (
              <p className="text-[10px] truncate leading-tight opacity-75 mt-0.5">📍 {event.location}</p>
            )}
            {showTime && (
              <p className="text-[10px] truncate leading-tight opacity-60 mt-0.5">
                {formatTime(start)} – {formatTime(end)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* SVG frame stroke for custom shapes — sibling of body, outside clip, renders on top */}
      {hasCustomShape && hasFrame && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          <path
            d={smoothedPath(pathToPoints(vs.shapePath), vs.shapeSmoothing)}
            fill="none"
            stroke={fc}
            strokeWidth={fw}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
      )}

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
