"use client"

import { useState } from "react"
import type React from "react"
import type { ApiEvent, VisualStyle } from "@/types"
import VisualStylePicker from "./VisualStylePicker"

interface EventEditorProps {
  date: Date | null
  startHour: number | null
  eventToEdit: ApiEvent | null
  prefillTitle?: string
  prefillDescription?: string
  onSave: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

function previewBorderStyle(vs: VisualStyle): React.CSSProperties {
  const hasF = vs.frameWidth > 0 && vs.frameColor !== "transparent"
  const hasS = vs.sideWidth > 0 && vs.sideColor !== "transparent"
  const fw = hasF ? vs.frameWidth : 0
  const fc = hasF ? vs.frameColor : "transparent"
  // Side shown via background gradient (avoids absolute positioning inside a tiny inline span)
  const sideGradient = hasS
    ? `linear-gradient(90deg, ${vs.sideColor} 0px, ${vs.sideColor} ${vs.sideWidth * 2}px, transparent ${vs.sideWidth * 2}px)`
    : undefined
  return {
    backgroundColor: vs.fillColor,
    backgroundImage: sideGradient,
    color: vs.textColor,
    borderTopWidth: fw, borderTopStyle: hasF ? "solid" : "none", borderTopColor: fc,
    borderRightWidth: fw, borderRightStyle: hasF ? "solid" : "none", borderRightColor: fc,
    borderBottomWidth: fw, borderBottomStyle: hasF ? "solid" : "none", borderBottomColor: fc,
    borderLeftWidth: fw, borderLeftStyle: hasF ? "solid" : "none", borderLeftColor: fc,
    borderRadius: vs.shape === "pill" ? "99px" : vs.shape === "rounded" ? "3px" : "0",
  }
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

const DEFAULT_VISUAL_STYLE: VisualStyle = {
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
}

function parseVisualStyle(raw: unknown): VisualStyle {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>
    return {
      shape: (["rectangle", "rounded", "pill"].includes(r.shape as string)
        ? r.shape
        : "rounded") as VisualStyle["shape"],
      frameColor: typeof r.frameColor === "string" ? r.frameColor : "transparent",
      frameWidth: typeof r.frameWidth === "number" ? r.frameWidth : 1,
      sideColor: typeof r.sideColor === "string" ? r.sideColor : "#c9a84c",
      sideWidth: typeof r.sideWidth === "number" ? r.sideWidth : 2,
      fillColor: typeof r.fillColor === "string" ? r.fillColor : "#162d5e",
      textColor: typeof r.textColor === "string" ? r.textColor : "#d1d5db",
      fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : "inherit",
      hasCheckbox: typeof r.hasCheckbox === "boolean" ? r.hasCheckbox : false,
      isChecked: typeof r.isChecked === "boolean" ? r.isChecked : false,
      eventType: typeof r.eventType === "string" ? r.eventType : "default",
    }
  }
  return DEFAULT_VISUAL_STYLE
}

export default function EventEditor({
  date,
  startHour,
  eventToEdit,
  prefillTitle,
  prefillDescription,
  onSave,
  onDelete,
  onClose,
}: EventEditorProps) {
  const isEdit = !!eventToEdit

  const defaultDate = eventToEdit
    ? toLocalDate(new Date(eventToEdit.startTime))
    : date
    ? toLocalDate(date)
    : toLocalDate(new Date())

  const defaultStart = eventToEdit
    ? toLocalTime(new Date(eventToEdit.startTime))
    : startHour !== null
    ? `${String(startHour).padStart(2, "0")}:00`
    : "09:00"

  const defaultEnd = eventToEdit
    ? toLocalTime(new Date(eventToEdit.endTime))
    : startHour !== null
    ? `${String(Math.min(startHour + 1, 23)).padStart(2, "0")}:00`
    : "10:00"

  const [title, setTitle] = useState(eventToEdit?.title ?? prefillTitle ?? "")
  const [description, setDescription] = useState(eventToEdit?.description ?? prefillDescription ?? "")
  const [location, setLocation] = useState(eventToEdit?.location ?? "")
  const [eventDate, setEventDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime] = useState(defaultEnd)
  const [flexible, setFlexible] = useState(eventToEdit?.isFlexible ?? false)
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(
    parseVisualStyle(eventToEdit?.visualStyle)
  )
  const [showStyle, setShowStyle] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const start = new Date(`${eventDate}T${startTime}`).toISOString()
      const end = new Date(`${eventDate}T${endTime}`).toISOString()

      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startTime: start,
        endTime: end,
        isFlexible: flexible,
        visualStyle,
      }

      if (isEdit && eventToEdit) {
        await fetch(`/api/events/${eventToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }

      await onSave()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-smoke-100 tracking-wide uppercase">
            {isEdit ? "Edit event" : "New event"}
          </h2>
          <button
            onClick={onClose}
            className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-smoke-300 mb-1">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event name..."
              className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 placeholder-smoke-500 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-smoke-300 mb-1">
              Description <span className="text-smoke-500">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes..."
              className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 placeholder-smoke-500 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs text-smoke-300 mb-1">
              Location <span className="text-smoke-500">(optional)</span>
            </label>
            <div className="relative">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Address or place..."
                className="w-full bg-smoke-800 border border-smoke-600 rounded-lg pl-3 pr-8 py-2 text-sm text-smoke-100 placeholder-smoke-500 focus:outline-none focus:border-doom-gold transition-colors"
              />
              {location.trim() && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-smoke-500 hover:text-doom-gold transition-colors text-xs"
                  title="Open in Google Maps"
                  onClick={(e) => e.stopPropagation()}
                >
                  ⊕
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-smoke-300 mb-1">Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-smoke-300 mb-1">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-smoke-300 mb-1">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={flexible}
              onChange={(e) => setFlexible(e.target.checked)}
              className="accent-doom-gold"
            />
            <span className="text-xs text-smoke-300">
              Flexible event — Plando can reschedule it
            </span>
          </label>

          {/* Visual style section */}
          <div className="border-t border-smoke-700 pt-3">
            <button
              type="button"
              onClick={() => setShowStyle((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-smoke-400 hover:text-smoke-200 transition-colors"
            >
              <span
                className="inline-block transition-transform duration-150"
                style={{ transform: showStyle ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                ▶
              </span>
              Style
              {/* Live preview mini-block */}
              <span
                className="ml-1 inline-flex items-center gap-0.5"
                style={{ fontFamily: visualStyle.fontFamily !== "inherit" ? visualStyle.fontFamily : undefined }}
              >
                <span
                  className="inline-block w-10 h-3.5 text-[7px] leading-none flex items-center justify-center overflow-hidden"
                  style={previewBorderStyle(visualStyle)}
                >
                  Aa
                </span>
              </span>
            </button>

            {showStyle && (
              <div className="mt-3">
                <VisualStylePicker value={visualStyle} onChange={setVisualStyle} />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            {isEdit && eventToEdit ? (
              <button
                type="button"
                onClick={() => onDelete(eventToEdit.id)}
                className="text-xs text-doom-ember hover:text-red-400 transition-colors"
              >
                Delete event
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-smoke-400 hover:text-smoke-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || loading}
                className="px-4 py-2 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
              >
                {loading ? "..." : isEdit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
