"use client"

import { useRef, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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

  return (
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

      {/* Day headers + Daily Notes row */}
      <div className="flex shrink-0 bg-navy-950 border-b border-smoke-700 z-10">
        {/* Spacer above time labels — matches scrollable area gutter */}
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
              {/* Day name + number */}
              <div
                className={`py-2 text-center border-b border-smoke-700 ${
                  today ? "bg-navy-800/60" : ""
                }`}
              >
                <span
                  className={`text-xs font-semibold tracking-widest uppercase ${
                    today ? "text-doom-gold" : "text-smoke-300"
                  }`}
                >
                  {DAY_NAMES[i]}
                </span>
                <span
                  className={`block text-xs mt-0.5 ${
                    today ? "text-doom-gold/70" : "text-smoke-400"
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Daily Notes area */}
              <div className="h-20 bg-navy-900/30 px-2 py-1.5">
                <p className="text-xs text-smoke-500 italic select-none">
                  Notes...
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable body — scrollbar-gutter:stable prevents header misalignment */}
      <div
        ref={scrollRef}
        className="flex flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
        {/* Hour labels column */}
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
            onSlotClick={(hour) => openCreate(date, hour)}
            onEventClick={openEdit}
          />
        ))}
      </div>

      {/* Event modal */}
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
  )
}
