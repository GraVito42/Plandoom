"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useDraggable } from "@dnd-kit/core"
import {
  Briefcase, Star, Heart, Flame, Zap, BookOpen, Tag, Flag,
  Home, Music, Camera, Coffee, Leaf, Globe, Shield, Bell,
} from "lucide-react"
import { HOUR_START, PX_PER_HOUR } from "@/hooks/useGrid"
import type { ApiEvent, VisualStyle, FolderSymbol } from "@/types"
import { pathToPoints, smoothedPath } from "@/lib/shapeUtils"

const SYMBOL_ICONS = {
  Briefcase, Star, Heart, Flame, Zap, BookOpen, Tag, Flag,
  Home, Music, Camera, Coffee, Leaf, Globe, Shield, Bell,
} as const

type SymbolIconName = keyof typeof SYMBOL_ICONS

function resolveSymbolSize(size: unknown): number {
  if (typeof size === "number") return size
  if (size === "sm") return 16
  if (size === "lg") return 40
  return 24
}

interface EventBlockProps {
  event: ApiEvent
  folderVisualStyle?: unknown
  resizeDeltaMinutes: number
  onClick: () => void
  onResizeStart: (clientY: number) => void
  onResizeMove: (clientY: number) => void
  onResizeEnd: () => void
  splitType?: "start" | "end" | "middle"
  overrideStartTime?: Date
  overrideEndTime?: Date
  isContinuation?: boolean
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function fillWithOpacity(color: string, opacity: number): string {
  if (opacity >= 100 || color === "transparent") return color
  const hex = color.startsWith("#") ? color.slice(1) : null
  if (!hex || (hex.length !== 6 && hex.length !== 3)) return color
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16)
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16)
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${(opacity / 100).toFixed(2)})`
}

function parseVisualStyle(raw: unknown): VisualStyle {
  const defaults: VisualStyle = {
    shape: "rounded",
    frameColor: "transparent",
    frameWidth: 1,
    sideColor: "#c9a84c",
    sideWidth: 2,
    fillColor: "#162d5e",
    fillOpacity: 100,
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
    fillOpacity: typeof r.fillOpacity === "number" ? r.fillOpacity : 100,
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

function parseFolderSymbol(vs: unknown): FolderSymbol | null {
  if (!vs || typeof vs !== "object" || Array.isArray(vs)) return null
  const r = vs as Record<string, unknown>
  const fs = r.folderSymbol
  if (!fs || typeof fs !== "object" || Array.isArray(fs)) return null
  const f = fs as Record<string, unknown>
  if (typeof f.color !== "string") return null
  const pos = f.position
  return {
    icon: typeof f.icon === "string" ? f.icon : null,
    customImage: typeof f.customImage === "string" ? f.customImage : null,
    color: f.color,
    size: resolveSymbolSize(f.size),
    position:
      pos && typeof pos === "object" && !Array.isArray(pos) &&
      typeof (pos as Record<string, unknown>).x === "number" &&
      typeof (pos as Record<string, unknown>).y === "number"
        ? { x: (pos as Record<string, unknown>).x as number, y: (pos as Record<string, unknown>).y as number }
        : null,
  }
}

function shapeRadius(shape: VisualStyle["shape"]): string {
  if (shape === "pill") return "9999px"
  if (shape === "rounded") return "4px"
  return "0"
}

export default function EventBlock({
  event,
  folderVisualStyle,
  resizeDeltaMinutes,
  onClick,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  splitType,
  overrideStartTime,
  overrideEndTime,
  isContinuation = false,
}: EventBlockProps) {
  const queryClient = useQueryClient()

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: isContinuation ? `${event.id}-cont` : event.id,
    data: { type: "event" },
    disabled: isContinuation,
  })

  const start = new Date(event.startTime)
  const end = new Date(event.endTime)

  const effectiveStart = (splitType === "end" || splitType === "middle") && overrideStartTime ? overrideStartTime : start
  const effectiveEnd = (splitType === "start" || splitType === "middle") && overrideEndTime ? overrideEndTime : end

  const minutesFromStart = (effectiveStart.getHours() - HOUR_START) * 60 + effectiveStart.getMinutes()
  const durationMinutes = Math.max(15, (effectiveEnd.getTime() - effectiveStart.getTime()) / 60_000)
  const top = minutesFromStart * (PX_PER_HOUR / 60)
  const baseHeight = Math.max(24, durationMinutes * (PX_PER_HOUR / 60))
  const height = Math.max(24, baseHeight + (isContinuation ? 0 : resizeDeltaMinutes * (PX_PER_HOUR / 60)))

  const vs = parseVisualStyle(event.visualStyle)
  const hasCustomShape = !!vs.shapePath
  const clipId = `clip-${event.id}`
  const radius = hasCustomShape ? "0" : shapeRadius(vs.shape)

  const hasFrame = vs.frameWidth > 0 && vs.frameColor !== "transparent"
  const hasSide = vs.sideWidth > 0 && vs.sideColor !== "transparent"
  const fw = hasFrame ? vs.frameWidth : 0
  const fc = hasFrame ? vs.frameColor : "transparent"

  const splitBorderRadius: React.CSSProperties = hasCustomShape ? {} : (
    splitType === "start"
      ? { borderTopLeftRadius: radius, borderTopRightRadius: radius, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
      : splitType === "end"
      ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: radius, borderBottomRightRadius: radius }
      : splitType === "middle"
      ? { borderRadius: 0 }
      : { borderRadius: radius }
  )

  const frameStyle: React.CSSProperties = hasCustomShape ? {} : {
    borderTopWidth: fw, borderTopStyle: hasFrame ? "solid" : "none", borderTopColor: fc,
    borderRightWidth: fw, borderRightStyle: hasFrame ? "solid" : "none", borderRightColor: fc,
    borderBottomWidth: fw, borderBottomStyle: hasFrame ? "solid" : "none", borderBottomColor: fc,
    borderLeftWidth: fw, borderLeftStyle: hasFrame ? "solid" : "none", borderLeftColor: fc,
  }

  const showLocation = !!event.location && height >= 34
  const showTime = height >= (showLocation ? 50 : 34)

  const widthPct = vs.widthPercent ?? 100
  const leftOffsetPct = vs.leftOffset ?? 0
  const textPos = hasCustomShape ? vs.textPosition : null

  // Folder symbol from parent folder's visualStyle
  const folderSym = parseFolderSymbol(folderVisualStyle)

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
          backgroundColor: fillWithOpacity(vs.fillColor, vs.fillOpacity),
          ...splitBorderRadius,
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

        {/* Split continuation indicators */}
        {splitType === "start" && (
          <div className="absolute bottom-0.5 right-1 text-[8px] pointer-events-none z-20 opacity-70 leading-none" style={{ color: vs.textColor }}>▶</div>
        )}
        {splitType === "end" && (
          <div className="absolute top-0.5 right-1 text-[8px] pointer-events-none z-20 opacity-70 leading-none" style={{ color: vs.textColor }}>◀</div>
        )}

        {/* Map pin */}
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

        {/* Folder symbol overlay */}
        {folderSym && (() => {
          const pos = folderSym.position ?? { x: 0.85, y: 0.1 }
          const iconSize = folderSym.size
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 10,
                lineHeight: 0,
              }}
            >
              {folderSym.customImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={folderSym.customImage}
                  alt=""
                  style={{ width: iconSize, height: iconSize, objectFit: "contain" }}
                />
              ) : folderSym.icon && SYMBOL_ICONS[folderSym.icon as SymbolIconName] ? (
                (() => {
                  const IconComp = SYMBOL_ICONS[folderSym.icon as SymbolIconName]
                  return <IconComp size={iconSize} color={folderSym.color} />
                })()
              ) : null}
            </div>
          )
        })()}

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
                {formatTime(effectiveStart)} – {formatTime(effectiveEnd)}
              </p>
            )}
          </div>
        ) : (
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
                {formatTime(effectiveStart)} – {formatTime(effectiveEnd)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* SVG frame stroke for custom shapes */}
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

      {/* Resize handle — not shown on continuation split cards */}
      {!isContinuation && (
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
      )}
    </div>
  )
}
