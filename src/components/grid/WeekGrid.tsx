"use client"

import { useRef, useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  useGrid,
  NOMI_GIORNI,
  ORA_INIZIO,
  ORA_FINE,
  PX_PER_ORA,
} from "@/hooks/useGrid"
import type { ApiEvent } from "@/types"
import DayColumn from "./DayColumn"
import EventEditor from "../events/EventEditor"

interface EditorState {
  open: boolean
  data: Date | null
  ora: number | null
  eventToEdit: ApiEvent | null
}

export default function WeekGrid() {
  const {
    inizioSettimana,
    fineSettimana,
    giorniSettimana,
    vaiSettimanaPrec,
    vaiSettimanaSucc,
    vaiAOggi,
    isOggi,
    formatRangeSettimana,
  } = useGrid()

  const scrollRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const [editor, setEditor] = useState<EditorState>({
    open: false,
    data: null,
    ora: null,
    eventToEdit: null,
  })

  const ore = Array.from(
    { length: ORA_FINE - ORA_INIZIO },
    (_, i) => i + ORA_INIZIO
  )

  // ── Fetch eventi della settimana corrente ──
  const { data: eventi = [] } = useQuery<ApiEvent[]>({
    queryKey: ["events", inizioSettimana.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/events?from=${inizioSettimana.toISOString()}&to=${fineSettimana.toISOString()}`
      )
      if (!res.ok) throw new Error("Errore nel caricamento degli eventi")
      return res.json() as Promise<ApiEvent[]>
    },
  })

  // ── Scroll automatico all'ora corrente al primo render ──
  useEffect(() => {
    if (!scrollRef.current) return
    const ora = new Date().getHours()
    const minuti = new Date().getMinutes()
    if (ora >= ORA_INIZIO && ora < ORA_FINE) {
      const offset = (ora - ORA_INIZIO) * PX_PER_ORA + minuti * (PX_PER_ORA / 60)
      scrollRef.current.scrollTop = Math.max(0, offset - 120)
    }
  }, [])

  // ── Filtra gli eventi per un dato giorno ──
  function eventiDelGiorno(data: Date): ApiEvent[] {
    return eventi.filter((ev) => {
      const start = new Date(ev.startTime)
      return (
        start.getFullYear() === data.getFullYear() &&
        start.getMonth() === data.getMonth() &&
        start.getDate() === data.getDate()
      )
    })
  }

  function apriCreazione(data: Date, ora: number) {
    setEditor({ open: true, data, ora, eventToEdit: null })
  }

  function apriModifica(ev: ApiEvent) {
    setEditor({ open: true, data: null, ora: null, eventToEdit: ev })
  }

  function chiudiEditor() {
    setEditor({ open: false, data: null, ora: null, eventToEdit: null })
  }

  async function onEventSalvato() {
    await queryClient.invalidateQueries({ queryKey: ["events"] })
    chiudiEditor()
  }

  async function onEventEliminato(id: string) {
    await fetch(`/api/events/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["events"] })
    chiudiEditor()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-navy-950">

      {/* ── Barra navigazione settimana ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-smoke-800 shrink-0 bg-navy-950">
        <div className="flex items-center gap-1">
          <button
            onClick={vaiSettimanaPrec}
            className="px-3 py-1.5 text-sm text-smoke-300 hover:text-doom-gold hover:bg-navy-800 rounded transition-colors"
          >
            ←
          </button>
          <button
            onClick={vaiAOggi}
            className="px-3 py-1.5 text-xs text-smoke-400 hover:text-doom-gold border border-smoke-700 hover:border-doom-gold/50 rounded transition-colors"
          >
            Oggi
          </button>
          <button
            onClick={vaiSettimanaSucc}
            className="px-3 py-1.5 text-sm text-smoke-300 hover:text-doom-gold hover:bg-navy-800 rounded transition-colors"
          >
            →
          </button>
        </div>
        <span className="text-sm font-medium text-smoke-300 tracking-wide">
          {formatRangeSettimana()}
        </span>
        <div className="w-28" /> {/* Bilancia il layout */}
      </div>

      {/* ── Intestazione: nomi giorni + Daily Notes ── */}
      <div className="flex shrink-0 bg-navy-950 border-b border-smoke-700 z-10">
        <div className="w-16 shrink-0 border-r border-smoke-800" />

        {giorniSettimana.map((data, i) => {
          const oggi = isOggi(data)
          return (
            <div
              key={i}
              className={`flex-1 flex flex-col border-l border-smoke-800 min-w-0 ${
                oggi ? "bg-navy-900/40" : ""
              }`}
            >
              {/* Nome giorno + numero */}
              <div
                className={`py-2 text-center border-b border-smoke-800 ${
                  oggi ? "bg-navy-800/60" : ""
                }`}
              >
                <span
                  className={`text-xs font-semibold tracking-widest uppercase ${
                    oggi ? "text-doom-gold" : "text-smoke-400"
                  }`}
                >
                  {NOMI_GIORNI[i]}
                </span>
                <span
                  className={`block text-xs mt-0.5 ${
                    oggi ? "text-doom-gold/60" : "text-smoke-600"
                  }`}
                >
                  {data.getDate()}
                </span>
              </div>

              {/* Area Note Giornaliere */}
              <div className="h-20 bg-navy-900/30 px-2 py-1.5">
                <p className="text-xs text-smoke-700 italic select-none">
                  Note...
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Corpo scrollabile ── */}
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto">
        {/* Colonna label orari */}
        <div className="w-16 shrink-0 border-r border-smoke-800 bg-navy-950">
          {ore.map((ora) => (
            <div
              key={ora}
              className="h-16 flex items-start justify-end pr-3 pt-1 border-b border-smoke-800/30"
            >
              <span className="text-xs text-smoke-600">
                {String(ora).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Colonne dei 7 giorni */}
        {giorniSettimana.map((data, i) => (
          <DayColumn
            key={i}
            data={data}
            ore={ore}
            eventi={eventiDelGiorno(data)}
            isOggi={isOggi(data)}
            onSlotClick={(ora) => apriCreazione(data, ora)}
            onEventClick={apriModifica}
          />
        ))}
      </div>

      {/* ── Modale evento ── */}
      {editor.open && (
        <EventEditor
          data={editor.data}
          oraInizio={editor.ora}
          eventToEdit={editor.eventToEdit}
          onSave={onEventSalvato}
          onDelete={onEventEliminato}
          onClose={chiudiEditor}
        />
      )}
    </div>
  )
}
