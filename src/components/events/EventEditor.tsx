"use client"

import { useState } from "react"
import type { ApiEvent } from "@/types"

interface EventEditorProps {
  data: Date | null
  oraInizio: number | null
  eventToEdit: ApiEvent | null
  onSave: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

// Formatta una Date come stringa YYYY-MM-DD in ora locale
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Formatta una Date come stringa HH:MM in ora locale
function toLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export default function EventEditor({
  data,
  oraInizio,
  eventToEdit,
  onSave,
  onDelete,
  onClose,
}: EventEditorProps) {
  const isModifica = !!eventToEdit

  // Valori iniziali del form
  const defaultData = eventToEdit
    ? toLocalDate(new Date(eventToEdit.startTime))
    : data
    ? toLocalDate(data)
    : toLocalDate(new Date())

  const defaultInizio = eventToEdit
    ? toLocalTime(new Date(eventToEdit.startTime))
    : oraInizio !== null
    ? `${String(oraInizio).padStart(2, "0")}:00`
    : "09:00"

  const defaultFine = eventToEdit
    ? toLocalTime(new Date(eventToEdit.endTime))
    : oraInizio !== null
    ? `${String(Math.min(oraInizio + 1, 23)).padStart(2, "0")}:00`
    : "10:00"

  const [titolo, setTitolo] = useState(eventToEdit?.title ?? "")
  const [descrizione, setDescrizione] = useState(eventToEdit?.description ?? "")
  const [dataEvento, setDataEvento] = useState(defaultData)
  const [inizio, setInizio] = useState(defaultInizio)
  const [fine, setFine] = useState(defaultFine)
  const [flessibile, setFlessibile] = useState(eventToEdit?.isFlexible ?? false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titolo.trim()) return

    setLoading(true)
    try {
      // new Date("YYYY-MM-DDTHH:MM") senza suffisso Z = ora locale del browser
      const startTime = new Date(`${dataEvento}T${inizio}`).toISOString()
      const endTime = new Date(`${dataEvento}T${fine}`).toISOString()

      const body = {
        title: titolo.trim(),
        description: descrizione.trim() || undefined,
        startTime,
        endTime,
        isFlexible: flessibile,
      }

      if (isModifica && eventToEdit) {
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
      {/* Sfondo scuro */}
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Pannello modale */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-smoke-100 tracking-wide uppercase">
            {isModifica ? "Modifica evento" : "Nuovo evento"}
          </h2>
          <button
            onClick={onClose}
            className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Titolo */}
          <div>
            <label className="block text-xs text-smoke-400 mb-1">Titolo</label>
            <input
              autoFocus
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="Nome evento..."
              className="w-full bg-smoke-800 border border-smoke-700 rounded-lg px-3 py-2 text-sm text-smoke-100 placeholder-smoke-600 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          {/* Descrizione */}
          <div>
            <label className="block text-xs text-smoke-400 mb-1">
              Descrizione <span className="text-smoke-600">(opzionale)</span>
            </label>
            <input
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Note aggiuntive..."
              className="w-full bg-smoke-800 border border-smoke-700 rounded-lg px-3 py-2 text-sm text-smoke-100 placeholder-smoke-600 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs text-smoke-400 mb-1">Data</label>
            <input
              type="date"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
              className="w-full bg-smoke-800 border border-smoke-700 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          {/* Orari */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-smoke-400 mb-1">Inizio</label>
              <input
                type="time"
                value={inizio}
                onChange={(e) => setInizio(e.target.value)}
                className="w-full bg-smoke-800 border border-smoke-700 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-smoke-400 mb-1">Fine</label>
              <input
                type="time"
                value={fine}
                onChange={(e) => setFine(e.target.value)}
                className="w-full bg-smoke-800 border border-smoke-700 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
              />
            </div>
          </div>

          {/* Evento flessibile */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={flessibile}
              onChange={(e) => setFlessibile(e.target.checked)}
              className="accent-doom-gold"
            />
            <span className="text-xs text-smoke-400">
              Evento flessibile — Plando può riposizionarlo
            </span>
          </label>

          {/* Azioni */}
          <div className="flex items-center justify-between pt-1">
            {isModifica && eventToEdit ? (
              <button
                type="button"
                onClick={() => onDelete(eventToEdit.id)}
                className="text-xs text-doom-ember hover:text-red-400 transition-colors"
              >
                Elimina evento
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
                Annulla
              </button>
              <button
                type="submit"
                disabled={!titolo.trim() || loading}
                className="px-4 py-2 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
              >
                {loading ? "..." : isModifica ? "Salva" : "Crea"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
