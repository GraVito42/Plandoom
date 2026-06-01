"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { SeendoExtractedEvent, SeendoContextForm, ApiFolder } from "@/types"

// Stato locale per ogni riga della review table
type ReviewRow = SeendoExtractedEvent & {
  selected: boolean
  folderId: string | null
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toReviewRow(e: SeendoExtractedEvent): ReviewRow {
  return {
    ...e,
    date: e.date ?? today(),
    startTime: e.startTime ?? "",
    endTime: e.endTime ?? "",
    selected: true,
    folderId: null,
  }
}

interface SeendoReviewProps {
  events: SeendoExtractedEvent[]
  contextForm: SeendoContextForm
  imageFile: File | null
  onImported: (importedIds: string[]) => void
  onDiscard: () => void
}

export default function SeendoReview({
  events,
  contextForm,
  imageFile,
  onImported,
  onDiscard,
}: SeendoReviewProps) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<ReviewRow[]>(() => events.map(toReviewRow))
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: () => fetch("/api/folders").then((r) => r.json()),
    staleTime: 60_000,
  })

  const selectedCount = rows.filter((r) => r.selected).length

  function toggleRow(i: number) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, selected: !r.selected } : r))
    )
  }

  function updateRow<K extends keyof ReviewRow>(i: number, key: K, value: ReviewRow[K]) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r))
    )
  }

  function selectAll(value: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: value })))
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected && r.title.trim())
    if (selected.length === 0) return
    setImporting(true)
    setError(null)
    try {
      // Crea gli eventi nel DB
      const created = await Promise.all(
        selected.map(async (item) => {
          const startIso = item.startTime
            ? new Date(`${item.date}T${item.startTime}`).toISOString()
            : new Date(`${item.date}T09:00`).toISOString()
          const endIso = item.endTime
            ? new Date(`${item.date}T${item.endTime}`).toISOString()
            : new Date(`${item.date}T10:00`).toISOString()
          const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: item.title.trim(),
              description: item.description ?? undefined,
              startTime: startIso,
              endTime: endIso,
              folderId: item.folderId ?? undefined,
            }),
          })
          if (!res.ok) throw new Error("Errore nella creazione dell'evento")
          return (await res.json()) as { id: string }
        })
      )

      const importedIds = created.map((e) => e.id)

      // Salva upload nell'archivio
      await fetch("/api/seendo/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageFile ? `placeholder:${imageFile.name}` : "placeholder",
          documentType: contextForm.documentType || undefined,
          referencePeriod: contextForm.referenceUnspecified
            ? undefined
            : `${contextForm.referenceText} (${contextForm.referencePeriod})`,
          timezone: contextForm.timezone || undefined,
          extractedEvents: events,
          importedEventIds: importedIds,
        }),
      })

      await queryClient.invalidateQueries({ queryKey: ["events"] })
      onImported(importedIds)
    } catch {
      setError("Importazione fallita. Riprova.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/85 backdrop-blur-sm" onClick={onDiscard} />

      <div className="relative z-10 w-full max-w-2xl mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-smoke-700 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-smoke-100 uppercase tracking-widest">
              Seendo — Review
            </h2>
            <p className="text-[10px] text-smoke-500 mt-0.5">
              {rows.length} eventi estratti — seleziona quelli da importare
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-smoke-500">
            <button
              onClick={() => selectAll(true)}
              className="hover:text-smoke-300 transition-colors"
            >
              Tutti
            </button>
            <span>·</span>
            <button
              onClick={() => selectAll(false)}
              className="hover:text-smoke-300 transition-colors"
            >
              Nessuno
            </button>
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {rows.length === 0 && (
            <p className="text-xs text-smoke-500 italic text-center py-6">
              Nessun evento trovato nell&apos;immagine.
            </p>
          )}

          {rows.map((row, i) => (
            <div
              key={i}
              className={`rounded-lg border transition-colors ${
                row.selected
                  ? "border-smoke-600 bg-smoke-800/60"
                  : "border-smoke-700/40 bg-smoke-800/20 opacity-50"
              }`}
            >
              {/* Riga titolo + checkbox + folder */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => toggleRow(i)}
                  className="accent-doom-gold shrink-0"
                />
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => updateRow(i, "title", e.target.value)}
                  placeholder="Titolo evento…"
                  className="flex-1 bg-transparent text-xs text-smoke-100 focus:outline-none min-w-0"
                />
                <select
                  value={row.folderId ?? ""}
                  onChange={(e) =>
                    updateRow(i, "folderId", e.target.value || null)
                  }
                  className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-300 focus:outline-none focus:border-doom-gold/50 max-w-[120px]"
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Riga data + ora */}
              <div className="flex items-center gap-2 px-3 pb-2.5 flex-wrap">
                <input
                  type="date"
                  value={row.date ?? ""}
                  onChange={(e) => updateRow(i, "date", e.target.value)}
                  className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold"
                />
                <input
                  type="time"
                  value={row.startTime ?? ""}
                  onChange={(e) => updateRow(i, "startTime", e.target.value)}
                  placeholder="Inizio"
                  className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold w-24"
                />
                <span className="text-smoke-600 text-[10px]">–</span>
                <input
                  type="time"
                  value={row.endTime ?? ""}
                  onChange={(e) => updateRow(i, "endTime", e.target.value)}
                  placeholder="Fine"
                  className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold w-24"
                />
                {row.description && (
                  <span className="text-[10px] text-smoke-600 italic truncate max-w-[200px]">
                    {row.description}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Errore */}
        {error && (
          <p className="mx-4 mb-2 text-xs text-doom-ember bg-doom-ember/10 border border-doom-ember/30 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-smoke-700 shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={onDiscard}
            className="px-4 py-2 text-sm text-smoke-400 hover:text-smoke-200 transition-colors"
          >
            Scarta tutto
          </button>
          <button
            onClick={handleImport}
            disabled={selectedCount === 0 || importing}
            className="px-5 py-2 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            {importing ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
                Importando…
              </>
            ) : (
              `Importa ${selectedCount} event${selectedCount !== 1 ? "i" : "o"}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
