"use client"

import { useRef, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DragOverlay } from "@dnd-kit/core"
import {
  useGrid,
  DAY_NAMES,
  HOUR_START,
  HOUR_END,
  PX_PER_HOUR,
} from "@/hooks/useGrid"
import { useChips } from "@/hooks/useChips"
import { useDragDrop } from "@/hooks/useDragDrop"
import type { ApiEvent, ApiChip } from "@/types"
import DayColumn from "./DayColumn"
import EventForm from "../events/EventForm/EventForm"
import ChipArea from "../chips/ChipArea"
import Pouch from "../chips/Pouch"
import Seendo from "../magic/Seendo"
import Plando from "../magic/Plando"
import Glando from "../magic/Glando"

interface EditorState {
  open: boolean
  date: Date | null
  hour: number | null
  eventToEdit: ApiEvent | null
  prefillTitle?: string
  prefillDescription?: string
}

interface ResizeState {
  eventId: string
  originalEndTime: string
  startClientY: number
  deltaMinutes: number
}

function snap15(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

export default function WeekGrid() {
  const {
    weekStart,
    weekEnd,
    weekDays,
    prevWeek,
    nextWeek,
    goToToday,
    isToday,
    formatWeekRange,
  } = useGrid()

  const scrollRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const [editor, setEditor] = useState<EditorState>({
    open: false,
    date: null,
    hour: null,
    eventToEdit: null,
  })
  const [pouchOpen, setPouchOpen] = useState(false)
  const [seendoOpen, setSeendoOpen] = useState(false)
  const [plandoOpen, setPlandoOpen] = useState(false)
  const [glandoOpen, setGlandoOpen] = useState(false)

  // Resize state — ref avoids stale closures in the async handler
  const [resizing, setResizingState] = useState<ResizeState | null>(null)
  const resizingRef = useRef<ResizeState | null>(null)
  function setResizing(val: ResizeState | null) {
    resizingRef.current = val
    setResizingState(val)
  }

  const [chipToConvert, setChipToConvert] = useState<ApiChip | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: events = [] } = useQuery<ApiEvent[]>({
    queryKey: ["events", weekStart.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/events?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`
      )
      if (!res.ok) throw new Error("Failed to load events")
      return res.json() as Promise<ApiEvent[]>
    },
  })

  const { chipsForDay } = useChips(weekStart, weekEnd)
  const { activeEvent, activeChip, activeDims } = useDragDrop(events)

  // ── Auto-scroll to current time on mount ────────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current) return
    const now = new Date()
    const offset = now.getHours() * PX_PER_HOUR + now.getMinutes() * (PX_PER_HOUR / 60)
    scrollRef.current.scrollTop = Math.max(0, offset - PX_PER_HOUR)
  }, [])

  // ── Data helpers ─────────────────────────────────────────────────────────────
  function eventsForDay(date: Date): ApiEvent[] {
    return events.filter((ev) => {
      const s = new Date(ev.startTime)
      return s.getFullYear() === date.getFullYear() &&
        s.getMonth() === date.getMonth() &&
        s.getDate() === date.getDate()
    })
  }

  // ── Editor ───────────────────────────────────────────────────────────────────
  function openCreate(date: Date, hour: number) {
    setEditor({ open: true, date, hour, eventToEdit: null })
  }

  function openEdit(ev: ApiEvent) {
    setEditor({ open: true, date: null, hour: null, eventToEdit: ev })
  }

  function openScheduleChip(chip: ApiChip) {
    setChipToConvert(chip)
    setEditor({
      open: true,
      date: new Date(),
      hour: 9,
      eventToEdit: null,
      prefillTitle: chip.title,
      prefillDescription: chip.description ?? undefined,
    })
  }

  function closeEditor() {
    setEditor({ open: false, date: null, hour: null, eventToEdit: null })
    setChipToConvert(null)
  }

  async function onEventSaved() {
    await queryClient.invalidateQueries({ queryKey: ["events"] })
    if (chipToConvert) {
      await fetch(`/api/chips/${chipToConvert.id}`, { method: "DELETE" })
      await queryClient.invalidateQueries({ queryKey: ["chips"] })
    }
    closeEditor()
  }

  async function onEventDeleted(id: string) {
    await fetch(`/api/events/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["events"] })
    closeEditor()
  }

  // ── Resize ───────────────────────────────────────────────────────────────────
  function handleResizeStart(eventId: string, clientY: number) {
    const event = events.find((e) => e.id === eventId)
    if (!event) return
    setResizing({ eventId, originalEndTime: event.endTime, startClientY: clientY, deltaMinutes: 0 })
  }

  function handleResizeMove(eventId: string, clientY: number) {
    const prev = resizingRef.current
    if (!prev || prev.eventId !== eventId) return
    const deltaMinutes = snap15((clientY - prev.startClientY) / (PX_PER_HOUR / 60))
    setResizing({ ...prev, deltaMinutes })
  }

  async function handleResizeEnd(eventId: string) {
    const state = resizingRef.current
    if (!state || state.eventId !== eventId) return
    const event = events.find((e) => e.id === eventId)
    setResizing(null)
    if (!event) return

    const newEnd = new Date(state.originalEndTime)
    newEnd.setMinutes(newEnd.getMinutes() + state.deltaMinutes)
    const minEnd = new Date(new Date(event.startTime).getTime() + 15 * 60 * 1000)
    if (newEnd < minEnd) return

    await fetch(`/api/events/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endTime: newEnd.toISOString() }),
    })
    await queryClient.invalidateQueries({ queryKey: ["events"] })
  }

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => i + HOUR_START)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-navy-950 relative">

      {/* Week navigation bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-smoke-700 shrink-0 bg-navy-950">
        <div className="flex items-center gap-1">
          <button onClick={prevWeek} className="px-3 py-1.5 text-sm text-smoke-300 hover:text-doom-gold hover:bg-navy-800 rounded transition-colors">←</button>
          <button onClick={goToToday} className="px-3 py-1.5 text-xs text-smoke-300 hover:text-doom-gold border border-smoke-600 hover:border-doom-gold/50 rounded transition-colors">Today</button>
          <button onClick={nextWeek} className="px-3 py-1.5 text-sm text-smoke-300 hover:text-doom-gold hover:bg-navy-800 rounded transition-colors">→</button>
        </div>
        <span className="text-sm font-medium text-smoke-200 tracking-wide">{formatWeekRange()}</span>
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setGlandoOpen(true)}
            className="px-3 py-1.5 text-xs border border-smoke-600 text-smoke-300 hover:text-doom-gold hover:border-doom-gold/50 rounded transition-colors"
            title="Lindo — Google Calendar sync"
          >
            Lindo
          </button>
          <button
            onClick={() => setPlandoOpen(true)}
            className="px-3 py-1.5 text-xs border border-smoke-600 text-smoke-300 hover:text-doom-gold hover:border-doom-gold/50 rounded transition-colors"
            title="Prodo — AI schedule optimizer"
          >
            Prodo
          </button>
          <button
            onClick={() => setSeendoOpen(true)}
            className="px-3 py-1.5 text-xs border border-smoke-600 text-smoke-300 hover:text-doom-gold hover:border-doom-gold/50 rounded transition-colors"
            title="Seendo — scan agenda image"
          >
            Seendo
          </button>
          <button
            onClick={() => setPouchOpen((v) => !v)}
            className={`px-3 py-1.5 text-xs border rounded transition-colors ${
              pouchOpen
                ? "text-doom-gold border-doom-gold/50 bg-navy-800"
                : "text-smoke-300 border-smoke-600 hover:text-doom-gold hover:border-doom-gold/50"
            }`}
          >
            Pouch
          </button>
        </div>
      </div>

      {/* ── Single scrollable container — sticky headers fix alignment ──────────
          The scrollbar lives inside this div, so all columns (header + body)
          share the same width. No more header/body 17px mismatch.          */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div style={{ display: "grid", gridTemplateColumns: "4rem 1fr" }}>

          {/* [0,0] Top-left corner — sticky, above day headers */}
          <div className="sticky top-0 z-40 bg-navy-950 border-r border-b border-smoke-700" />

          {/* [0,1] Day headers — sticky top, above events (z-20) */}
          <div className="sticky top-0 z-30 flex bg-navy-950 border-b border-smoke-700">
            {weekDays.map((date, i) => {
              const today = isToday(date)
              return (
                <div
                  key={i}
                  className={`flex-1 flex flex-col border-l border-smoke-700 min-w-0 ${today ? "bg-navy-900/40" : ""}`}
                >
                  <div className={`py-2 text-center border-b border-smoke-700 ${today ? "bg-navy-800/60" : ""}`}>
                    <span className={`text-xs font-semibold tracking-widest uppercase ${today ? "text-doom-gold" : "text-smoke-300"}`}>
                      {DAY_NAMES[i]}
                    </span>
                    <span className={`block text-xs mt-0.5 ${today ? "text-doom-gold/70" : "text-smoke-400"}`}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div className="min-h-20 bg-navy-900/30 px-2 py-1.5">
                    <ChipArea
                      area="daily"
                      chips={chipsForDay(date)}
                      draggable
                      dayTarget={new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0).toISOString()}
                      onSchedule={openScheduleChip}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* [1,0] Hour labels */}
          <div className="border-r border-smoke-700 bg-navy-950">
            {hours.map((hour) => (
              <div key={hour} className="h-16 flex items-start justify-end pr-3 pt-1 border-b border-smoke-700/40">
                <span className="text-xs text-smoke-400">{String(hour).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {/* [1,1] Day columns */}
          <div className="flex">
            {weekDays.map((date, i) => (
              <DayColumn
                key={i}
                date={date}
                hours={hours}
                events={eventsForDay(date)}
                isToday={isToday(date)}
                resizingEventId={resizing?.eventId ?? null}
                resizeDeltaMinutes={resizing?.deltaMinutes ?? 0}
                onSlotClick={(hour) => openCreate(date, hour)}
                onEventClick={openEdit}
                onResizeStart={handleResizeStart}
                onResizeMove={handleResizeMove}
                onResizeEnd={handleResizeEnd}
              />
            ))}
          </div>

        </div>
      </div>

      {/* Pouch panel */}
      {pouchOpen && (
        <Pouch onClose={() => setPouchOpen(false)} onSchedule={openScheduleChip} />
      )}

      {/* Seendo modal */}
      {seendoOpen && <Seendo onClose={() => setSeendoOpen(false)} />}

      {/* Prodo modal */}
      {plandoOpen && (
        <Plando weekStart={weekStart} weekEnd={weekEnd} onClose={() => setPlandoOpen(false)} />
      )}

      {/* Lindo modal */}
      {glandoOpen && <Glando onClose={() => setGlandoOpen(false)} />}

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeEvent && activeDims ? (
          <div
            style={{ width: activeDims.width, height: activeDims.height }}
            className="bg-navy-500 border-l-2 border-doom-gold rounded px-1.5 py-0.5 opacity-90 shadow-2xl ring-1 ring-doom-gold/40 rotate-1 cursor-grabbing"
          >
            <p className="text-xs font-medium text-smoke-100 truncate leading-tight">{activeEvent.title}</p>
          </div>
        ) : activeChip && activeDims ? (
          <div
            style={{ width: Math.max(120, activeDims.width) }}
            className="bg-navy-800 border border-doom-gold/50 rounded px-2 py-1.5 opacity-90 shadow-xl ring-1 ring-doom-gold/30 rotate-1 cursor-grabbing"
          >
            <p className="text-xs text-smoke-200 truncate">{activeChip.title}</p>
          </div>
        ) : null}
      </DragOverlay>

      {/* Event form modal */}
      {editor.open && (
        <EventForm
          date={editor.date}
          startHour={editor.hour}
          eventToEdit={editor.eventToEdit}
          prefillTitle={editor.prefillTitle}
          prefillDescription={editor.prefillDescription}
          onSave={onEventSaved}
          onDelete={onEventDeleted}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}
