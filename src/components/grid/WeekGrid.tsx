"use client"

import { useRef, useEffect, useState, useMemo } from "react"
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
import type { ApiEvent, ApiChip, ApiFolder } from "@/types"
import { getSeendoResetDate } from "@/lib/seendo-budget"
import { isFullDayEvent, parsePillStyle } from "@/lib/eventUtils"
import DayColumn from "./DayColumn"
import EventForm from "../events/EventForm/EventForm"
import ChipArea from "../chips/ChipArea"
import Pouch from "../chips/Pouch"
import Seendo from "../magic/Seendo"
import SeendoLogo from "../magic/SeendoLogo"
import Plando from "../magic/Plando"
import Glando from "../magic/Glando"
import DayNotePopover from "../notes/DayNotePopover"

// Chiave localStorage usata in Seendo.tsx per attivare/disattivare la linea
const LS_SEENDO_RESET_LINE = "plandoom_seendo_reset_line"

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
  const dayHeaderRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)
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

  // ── Seendo reset line ────────────────────────────────────────────────────────
  const [seendoLineActive, setSeendoLineActive] = useState(false)
  const seendoResetDate = useMemo(() => getSeendoResetDate(), [])

  useEffect(() => {
    // Se la data di reset è già passata, rimuovi la chiave e non mostrare la linea
    if (seendoResetDate < new Date()) {
      localStorage.removeItem(LS_SEENDO_RESET_LINE)
      setSeendoLineActive(false)
      return
    }
    setSeendoLineActive(localStorage.getItem(LS_SEENDO_RESET_LINE) === "true")

    function handleStorage(e: StorageEvent) {
      if (e.key === LS_SEENDO_RESET_LINE) {
        setSeendoLineActive(localStorage.getItem(LS_SEENDO_RESET_LINE) === "true")
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [seendoResetDate])

  // Restituisce la label formattata (es. "1 Jul") per il giorno che coincide
  // con la data di reset; stringa vuota se nessuna corrispondenza o linea inattiva
  function seendoResetLabelForDay(date: Date): string {
    if (!seendoLineActive) return ""
    if (
      seendoResetDate.getFullYear() === date.getFullYear() &&
      seendoResetDate.getMonth() === date.getMonth() &&
      seendoResetDate.getDate() === date.getDate()
    ) {
      return seendoResetDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    }
    return ""
  }

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

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      if (!res.ok) throw new Error("Failed to load folders")
      return res.json() as Promise<ApiFolder[]>
    },
  })

  const folderMap = useMemo(
    () => Object.fromEntries(folders.map((f) => [f.id, f])),
    [folders]
  )

  // Full-day event pills for the band — greedy row assignment
  const fullDayPills = useMemo(() => {
    const fd = events.filter(isFullDayEvent)
    const placed: { ev: ApiEvent; colStart: number; colEnd: number; row: number }[] = []
    for (const ev of fd) {
      const s = new Date(ev.startTime)
      const e = new Date(ev.endTime)
      const startDiff = Math.floor((s.getTime() - weekStart.getTime()) / 86_400_000)
      const endDiff = Math.floor((e.getTime() - weekStart.getTime() - 1) / 86_400_000)
      if (startDiff > 6 || endDiff < 0) continue
      const colStart = Math.max(0, Math.min(6, startDiff))
      const colEnd = Math.max(colStart, Math.min(6, endDiff))
      let row = 0
      while (placed.some((p) => p.row === row && !(p.colEnd < colStart || p.colStart > colEnd))) {
        row++
      }
      placed.push({ ev, colStart, colEnd, row })
    }
    return placed
  }, [events, weekStart])

  const maxPillRow = fullDayPills.length > 0 ? Math.max(...fullDayPills.map((p) => p.row)) : 0
  const fdBandHeight = fullDayPills.length > 0 ? Math.max(28, (maxPillRow + 1) * 26 + 4) : 0

  // Prefetch delle 7 daily note — così i dot colorati appaiono senza latenza
  useEffect(() => {
    weekDays.forEach((date) => {
      const dateUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const dateISO = dateUTC.toISOString()
      void queryClient.prefetchQuery({
        queryKey: ["dailyNote", dateISO],
        queryFn: async () => {
          const res = await fetch(`/api/notes/daily?date=${encodeURIComponent(dateISO)}`)
          if (!res.ok) throw new Error("Failed")
          return res.json()
        },
      })
    })
  }, [weekStart.toISOString()]) // eslint-disable-line react-hooks/exhaustive-deps

  const { chipsForDay } = useChips(weekStart, weekEnd)
  const { activeEvent, activeChip, activeDims } = useDragDrop(events)

  // ── Auto-scroll to current time on mount ────────────────────────────────────
  useEffect(() => {
    if (!scrollRef.current) return
    const now = new Date()
    const offset = now.getHours() * PX_PER_HOUR + now.getMinutes() * (PX_PER_HOUR / 60)
    scrollRef.current.scrollTop = Math.max(0, offset - PX_PER_HOUR)
  }, [])

  // ── Measure header height for sticky full-day band positioning ───────────────
  useEffect(() => {
    const el = dayHeaderRef.current
    if (!el) return
    const update = () => setHeaderHeight(el.offsetHeight)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Data helpers ─────────────────────────────────────────────────────────────
  function eventsForDay(date: Date): ApiEvent[] {
    return events.filter((ev) => {
      if (isFullDayEvent(ev)) return false
      const s = new Date(ev.startTime)
      return s.getFullYear() === date.getFullYear() &&
        s.getMonth() === date.getMonth() &&
        s.getDate() === date.getDate()
    })
  }

  function continuationEventsForDay(date: Date): ApiEvent[] {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
    return events.filter((ev) => {
      if (isFullDayEvent(ev)) return false
      if (!(ev.allowMultiDay ?? false)) return false
      const s = new Date(ev.startTime)
      const e = new Date(ev.endTime)
      return s < dayStart && e > dayStart
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
            className="px-3 py-1.5 border border-smoke-600 hover:border-doom-gold/50 rounded transition-colors flex items-center justify-center"
            title="Seendo — scan agenda image"
          >
            <SeendoLogo size="sm" />
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
          <div ref={dayHeaderRef} className="sticky top-0 z-30 flex bg-navy-950 border-b border-smoke-700">
            {weekDays.map((date, i) => {
              const today = isToday(date)
              return (
                <div
                  key={i}
                  className={`flex-1 flex flex-col border-l border-smoke-700 min-w-0 ${today ? "bg-navy-900/40" : ""}`}
                >
                  <DayNotePopover
                    date={date}
                    dayLabel={DAY_NAMES[i]}
                    isToday={today}
                  />
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

          {/* [1,0] + [1,1] Full-day band — only rendered when events exist this week */}
          {fullDayPills.length > 0 && (
            <>
              <div
                className="sticky z-20 bg-navy-950 border-r border-b border-smoke-700"
                style={{ top: headerHeight }}
              />
              <div
                className="sticky z-20 bg-navy-900 border-b border-smoke-700 relative overflow-hidden"
                style={{ top: headerHeight, height: fdBandHeight }}
              >
                {/* Column dividers */}
                <div className="absolute inset-0 flex">
                  {weekDays.map((_, i) => (
                    <div key={i} className={`flex-1 ${i > 0 ? "border-l border-smoke-700" : ""}`} />
                  ))}
                </div>
                {/* Pills */}
                {fullDayPills.map(({ ev, colStart, colEnd, row }) => {
                  const pill = parsePillStyle(ev.visualStyle)
                  return (
                    <div
                      key={ev.id}
                      className="absolute rounded-full text-xs font-medium truncate px-2 py-0.5 cursor-pointer hover:brightness-110 transition-all z-10"
                      style={{
                        left: `calc(${(colStart / 7) * 100}% + 2px)`,
                        width: `calc(${((colEnd - colStart + 1) / 7) * 100}% - 4px)`,
                        top: row * 26 + 2,
                        height: 22,
                        backgroundColor: pill.backgroundColor,
                        border: pill.border,
                        color: pill.color,
                        fontFamily: pill.fontFamily,
                      }}
                      onClick={() => openEdit(ev)}
                    >
                      {ev.title}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* [2,0] Hour labels */}
          <div className="border-r border-smoke-700 bg-navy-950">
            {hours.map((hour) => (
              <div key={hour} className="h-16 flex items-start justify-end pr-3 pt-1 border-b border-smoke-700/40">
                <span className="text-xs text-smoke-400">{String(hour).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {/* [2,1] Day columns */}
          <div className="flex">
            {weekDays.map((date, i) => (
              <DayColumn
                key={i}
                date={date}
                hours={hours}
                events={eventsForDay(date)}
                continuationEvents={continuationEventsForDay(date)}
                isToday={isToday(date)}
                resizingEventId={resizing?.eventId ?? null}
                resizeDeltaMinutes={resizing?.deltaMinutes ?? 0}
                folderMap={folderMap}
                onSlotClick={(hour) => openCreate(date, hour)}
                onEventClick={openEdit}
                onResizeStart={handleResizeStart}
                onResizeMove={handleResizeMove}
                onResizeEnd={handleResizeEnd}
                seendoResetLabel={seendoResetLabelForDay(date)}
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
