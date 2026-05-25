"use client"

import { useRef, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  useGrid,
  DAY_NAMES,
  HOUR_START,
  HOUR_END,
  PX_PER_HOUR,
} from "@/hooks/useGrid"
import type { ApiEvent } from "@/types"
import DayColumn from "./DayColumn"
import EventEditor from "../events/EventEditor"

interface EditorState {
  open: boolean
  date: Date | null
  hour: number | null
  eventToEdit: ApiEvent | null
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

  // Drag-to-move state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeEvent, setActiveEvent] = useState<ApiEvent | null>(null)
  const [activeDims, setActiveDims] = useState<{ width: number; height: number } | null>(null)

  // Resize state — stored in both state (for render) and ref (to avoid stale closure in handler)
  const [resizing, setResizingState] = useState<ResizeState | null>(null)
  const resizingRef = useRef<ResizeState | null>(null)
  function setResizing(val: ResizeState | null) {
    resizingRef.current = val
    setResizingState(val)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const hours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => i + HOUR_START
  )

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

  useEffect(() => {
    if (!scrollRef.current) return
    const hour = new Date().getHours()
    const minutes = new Date().getMinutes()
    if (hour >= HOUR_START && hour < HOUR_END) {
      const offset = (hour - HOUR_START) * PX_PER_HOUR + minutes * (PX_PER_HOUR / 60)
      scrollRef.current.scrollTop = Math.max(0, offset - 120)
    }
  }, [])

  function eventsForDay(date: Date): ApiEvent[] {
    return events.filter((ev) => {
      const start = new Date(ev.startTime)
      return (
        start.getFullYear() === date.getFullYear() &&
        start.getMonth() === date.getMonth() &&
        start.getDate() === date.getDate()
      )
    })
  }

  // ── Editor ──────────────────────────────────────────────────────────────────
  function openCreate(date: Date, hour: number) {
    setEditor({ open: true, date, hour, eventToEdit: null })
  }

  function openEdit(ev: ApiEvent) {
    setEditor({ open: true, date: null, hour: null, eventToEdit: ev })
  }

  function closeEditor() {
    setEditor({ open: false, date: null, hour: null, eventToEdit: null })
  }

  async function onEventSaved() {
    await queryClient.invalidateQueries({ queryKey: ["events"] })
    closeEditor()
  }

  async function onEventDeleted(id: string) {
    await fetch(`/api/events/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["events"] })
    closeEditor()
  }

  // ── Drag-to-move ─────────────────────────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    const id = active.id as string
    setActiveId(id)
    setActiveEvent(events.find((e) => e.id === id) ?? null)
    const rect = active.rect.current.initial
    if (rect) setActiveDims({ width: rect.width, height: rect.height })
  }

  async function handleDragEnd({ active, over, delta }: DragEndEvent) {
    const draggedId = activeId
    setActiveId(null)
    setActiveEvent(null)
    setActiveDims(null)

    if (!over || !draggedId) return

    const event = events.find((e) => e.id === draggedId)
    if (!event) return

    // over.id is "YYYY-MM-DD" of the target day column
    const [year, month, day] = (over.id as string).split("-").map(Number)

    const originalStart = new Date(event.startTime)
    const originalEnd = new Date(event.endTime)
    const durationMs = originalEnd.getTime() - originalStart.getTime()

    const deltaMinutes = snap15(delta.y / (PX_PER_HOUR / 60))

    const newStart = new Date(originalStart)
    newStart.setFullYear(year, month - 1, day)
    newStart.setMinutes(newStart.getMinutes() + deltaMinutes)

    // Clamp within visible grid
    if (newStart.getHours() < HOUR_START) newStart.setHours(HOUR_START, 0, 0, 0)
    if (newStart.getHours() >= HOUR_END) newStart.setHours(HOUR_END - 1, 45, 0, 0)

    const newEnd = new Date(newStart.getTime() + durationMs)

    await fetch(`/api/events/${draggedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      }),
    })
    await queryClient.invalidateQueries({ queryKey: ["events"] })
  }

  function handleDragCancel() {
    setActiveId(null)
    setActiveEvent(null)
    setActiveDims(null)
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

    // Enforce minimum 15-minute duration
    const minEnd = new Date(new Date(event.startTime).getTime() + 15 * 60 * 1000)
    if (newEnd < minEnd) return

    await fetch(`/api/events/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endTime: newEnd.toISOString() }),
    })
    await queryClient.invalidateQueries({ queryKey: ["events"] })
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col h-full overflow-hidden bg-navy-950">

        {/* Week navigation bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-smoke-700 shrink-0 bg-navy-950">
          <div className="flex items-center gap-1">
            <button
              onClick={prevWeek}
              className="px-3 py-1.5 text-sm text-smoke-300 hover:text-doom-gold hover:bg-navy-800 rounded transition-colors"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs text-smoke-300 hover:text-doom-gold border border-smoke-600 hover:border-doom-gold/50 rounded transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextWeek}
              className="px-3 py-1.5 text-sm text-smoke-300 hover:text-doom-gold hover:bg-navy-800 rounded transition-colors"
            >
              →
            </button>
          </div>
          <span className="text-sm font-medium text-smoke-200 tracking-wide">
            {formatWeekRange()}
          </span>
          <div className="w-28" />
        </div>

        {/* Day headers + Daily Notes */}
        <div className="flex shrink-0 bg-navy-950 border-b border-smoke-700 z-10">
          <div className="w-16 shrink-0 border-r border-smoke-700" />
          {weekDays.map((date, i) => {
            const today = isToday(date)
            return (
              <div
                key={i}
                className={`flex-1 flex flex-col border-l border-smoke-700 min-w-0 ${
                  today ? "bg-navy-900/40" : ""
                }`}
              >
                <div className={`py-2 text-center border-b border-smoke-700 ${today ? "bg-navy-800/60" : ""}`}>
                  <span className={`text-xs font-semibold tracking-widest uppercase ${today ? "text-doom-gold" : "text-smoke-300"}`}>
                    {DAY_NAMES[i]}
                  </span>
                  <span className={`block text-xs mt-0.5 ${today ? "text-doom-gold/70" : "text-smoke-400"}`}>
                    {date.getDate()}
                  </span>
                </div>
                <div className="h-20 bg-navy-900/30 px-2 py-1.5">
                  <p className="text-xs text-smoke-500 italic select-none">Notes...</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Scrollable grid body */}
        <div
          ref={scrollRef}
          className="flex flex-1 overflow-y-auto [scrollbar-gutter:stable]"
        >
          {/* Hour labels */}
          <div className="w-16 shrink-0 border-r border-smoke-700 bg-navy-950">
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-16 flex items-start justify-end pr-3 pt-1 border-b border-smoke-700/40"
              >
                <span className="text-xs text-smoke-400">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* 7 day columns */}
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

        {/* Floating drag preview */}
        <DragOverlay dropAnimation={null}>
          {activeEvent && activeDims ? (
            <div
              style={{ width: activeDims.width, height: activeDims.height }}
              className="bg-navy-500 border-l-2 border-doom-gold rounded px-1.5 py-0.5 opacity-90 shadow-2xl ring-1 ring-doom-gold/40 rotate-1 cursor-grabbing"
            >
              <p className="text-xs font-medium text-smoke-100 truncate leading-tight">
                {activeEvent.title}
              </p>
            </div>
          ) : null}
        </DragOverlay>

        {/* Event editor modal */}
        {editor.open && (
          <EventEditor
            date={editor.date}
            startHour={editor.hour}
            eventToEdit={editor.eventToEdit}
            onSave={onEventSaved}
            onDelete={onEventDeleted}
            onClose={closeEditor}
          />
        )}
      </div>
    </DndContext>
  )
}
