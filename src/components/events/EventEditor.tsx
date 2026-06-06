"use client"

import { useState } from "react"
import type React from "react"
import type { ApiEvent, VisualStyle } from "@/types"
import VisualStylePicker from "./VisualStylePicker"
import SeendoEventTab from "./SeendoEventTab"
import SeendoLogo from "@/components/magic/SeendoLogo"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

function parseVisualStyle(raw: unknown): VisualStyle {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>
    const tp = r.textPosition as { x: number; y: number } | null | undefined
    return {
      shape: (["rectangle", "rounded", "pill"].includes(r.shape as string)
        ? r.shape
        : "rounded") as VisualStyle["shape"],
      frameColor: typeof r.frameColor === "string" ? r.frameColor : "transparent",
      frameWidth: typeof r.frameWidth === "number" ? r.frameWidth : 1,
      sideColor: typeof r.sideColor === "string" ? r.sideColor : "#c9a84c",
      sideWidth: typeof r.sideWidth === "number" ? r.sideWidth : 2,
      fillColor: typeof r.fillColor === "string" ? r.fillColor : "#162d5e",
      fillOpacity: typeof r.fillOpacity === "number" ? r.fillOpacity : 100,
      textColor: typeof r.textColor === "string" ? r.textColor : "#d1d5db",
      fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : "inherit",
      hasCheckbox: typeof r.hasCheckbox === "boolean" ? r.hasCheckbox : false,
      isChecked: typeof r.isChecked === "boolean" ? r.isChecked : false,
      eventType: typeof r.eventType === "string" ? r.eventType : "default",
      shapePath: typeof r.shapePath === "string" ? r.shapePath : null,
      shapeSmoothing: typeof r.shapeSmoothing === "number" ? r.shapeSmoothing : 0,
      textPosition: tp && typeof tp.x === "number" && typeof tp.y === "number" ? tp : null,
      widthPercent: typeof r.widthPercent === "number" ? r.widthPercent : 100,
      leftOffset: typeof r.leftOffset === "number" ? r.leftOffset : 0,
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
  const [styleOpen, setStyleOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [seendoOpen, setSeendoOpen] = useState(false)
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
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-smoke-700 shrink-0">
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

        {/* Three columns */}
        <div className="flex flex-1 min-h-0 divide-x divide-smoke-700 overflow-hidden">

          {/* LEFT — Style (~20%) */}
          <div
            className="flex flex-col shrink-0 transition-all duration-200 overflow-hidden"
            style={{ width: styleOpen ? "15%" : "2rem" }}
          >
            <button
              type="button"
              onClick={() => setStyleOpen((o) => !o)}
              className={`flex items-center shrink-0 border-b border-smoke-700 w-full hover:bg-smoke-800 transition-colors ${styleOpen ? "justify-between px-3 py-2" : "justify-center py-2"}`}
            >
              {styleOpen ? (
                <>
                  <span className="text-[10px] text-smoke-400 uppercase tracking-widest select-none">Style</span>
                  <ChevronLeft size={14} className="text-smoke-400 shrink-0" />
                </>
              ) : (
                <ChevronRight size={14} className="text-smoke-400" />
              )}
            </button>
            {styleOpen ? (
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <div className="mb-3">
                  <span className="text-[10px] text-smoke-500 block mb-1">Preview</span>
                  <span
                    className="block w-full h-4 text-[7px] leading-none flex items-center justify-center overflow-hidden"
                    style={previewBorderStyle(visualStyle)}
                  >
                    Aa
                  </span>
                </div>
                <VisualStylePicker value={visualStyle} onChange={setVisualStyle} />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-widest text-smoke-600 whitespace-nowrap select-none [writing-mode:vertical-rl] rotate-180">
                  Style
                </span>
              </div>
            )}
          </div>

          {/* CENTER — Content (~60%, flex-1) */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="px-4 py-1.5 border-b border-smoke-700 shrink-0">
              <span className="text-[10px] text-smoke-500 uppercase tracking-widest">Content</span>
            </div>
            <form
              id="event-editor-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4"
            >
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

              {/* Seendo — allegati e file OCR (solo in modalità edit) */}
              {isEdit && eventToEdit && (
                <div className="border-t border-smoke-700 -mx-4 px-4 pt-3 pb-1">
                  <button
                    type="button"
                    onClick={() => setSeendoOpen((o) => !o)}
                    className="flex items-center justify-center w-full py-1 hover:opacity-70 transition-opacity mb-2"
                  >
                    <SeendoLogo size="sm" />
                  </button>
                  {seendoOpen && (
                    <SeendoEventTab
                      eventId={eventToEdit.id}
                      seendoSourceUploadId={eventToEdit.seendoSourceUploadId}
                      seendoImages={eventToEdit.seendoImages}
                      initialFiles={eventToEdit.seendoFiles}
                    />
                  )}
                </div>
              )}
            </form>
          </div>

          {/* RIGHT — Folder (~20%) */}
          <div
            className="flex flex-col shrink-0 transition-all duration-200 overflow-hidden"
            style={{ width: folderOpen ? "15%" : "2rem" }}
          >
            <button
              type="button"
              onClick={() => setFolderOpen((o) => !o)}
              className={`flex items-center shrink-0 border-b border-smoke-700 w-full hover:bg-smoke-800 transition-colors ${folderOpen ? "justify-between px-3 py-2" : "justify-center py-2"}`}
            >
              {folderOpen ? (
                <>
                  <span className="text-[10px] text-smoke-400 uppercase tracking-widest select-none">Folder</span>
                  <ChevronRight size={14} className="text-smoke-400 shrink-0" />
                </>
              ) : (
                <ChevronLeft size={14} className="text-smoke-400" />
              )}
            </button>
            {folderOpen ? (
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <p className="text-[10px] text-smoke-600 italic">No folder selected.</p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-widest text-smoke-600 whitespace-nowrap select-none [writing-mode:vertical-rl]">
                  Folder
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Footer — actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-smoke-700 shrink-0">
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
              form="event-editor-form"
              disabled={!title.trim() || loading}
              className="px-4 py-2 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
            >
              {loading ? "..." : isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
