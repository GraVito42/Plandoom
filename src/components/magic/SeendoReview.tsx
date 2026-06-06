"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { SeendoExtractedEvent, SeendoContextForm, ApiFolder } from "@/types"

type ReviewRow = SeendoExtractedEvent & {
  selected: boolean
  folderId: string | null
  isFullDay: boolean
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
    isFullDay: !e.startTime,
  }
}

// ── Compressione immagine lato client per difficulty "low" ────────────────────

async function compressImageToLow(file: File): Promise<File> {
  const MAX_SIDE = 800
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      let targetW = w
      let targetH = h
      if (w > MAX_SIDE || h > MAX_SIDE) {
        if (w >= h) {
          targetW = MAX_SIDE
          targetH = Math.round(h * (MAX_SIDE / w))
        } else {
          targetH = MAX_SIDE
          targetW = Math.round(w * (MAX_SIDE / h))
        }
      }
      const canvas = document.createElement("canvas")
      canvas.width = targetW
      canvas.height = targetH
      canvas.getContext("2d")!.drawImage(img, 0, 0, targetW, targetH)
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.75
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ─────────────────────────────────────────────────────────────────────────────

interface SeendoReviewProps {
  events: SeendoExtractedEvent[]
  contextForm: SeendoContextForm
  imageFile: File | null
  imageUrl: string
  imageSizeBytes: number
  difficulty: "low" | "medium" | "high"
  onImported: (importedIds: string[]) => void
  onDiscard: () => void
}

export default function SeendoReview({
  events,
  contextForm,
  imageFile,
  imageUrl,
  imageSizeBytes,
  difficulty,
  onImported,
  onDiscard,
}: SeendoReviewProps) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<ReviewRow[]>(() => events.map(toReviewRow))
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // imageUrl e imageSizeBytes possono aggiornarsi dopo un re-read
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl)
  const [currentImageSizeBytes, setCurrentImageSizeBytes] = useState(imageSizeBytes)

  // Stato Re-read
  const [rereadOpen, setRereadOpen] = useState(false)
  const [rereadDifficulty, setRereadDifficulty] = useState<"low" | "medium" | "high">(difficulty)
  const [rereading, setRereading] = useState(false)
  const [rereadError, setRereadError] = useState<string | null>(null)

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

  async function handleReread() {
    if (!imageFile) return
    setRereading(true)
    setRereadError(null)
    try {
      const imageToSend = rereadDifficulty === "low" ? await compressImageToLow(imageFile) : imageFile
      const fd = new FormData()
      fd.append("image", imageToSend)
      fd.append("referenceText", contextForm.referenceText)
      fd.append("referencePeriod", contextForm.referencePeriod)
      fd.append("referenceUnspecified", String(contextForm.referenceUnspecified))
      fd.append("timezone", contextForm.timezone)
      fd.append("documentType", contextForm.documentType)
      fd.append("furtherInstructions", contextForm.furtherInstructions)
      fd.append("difficulty", rereadDifficulty)

      const res = await fetch("/api/seendo", { method: "POST", body: fd })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Re-read failed")
      }
      const data = (await res.json()) as { events: SeendoExtractedEvent[]; imageUrl: string; imageSizeBytes: number }
      setCurrentImageUrl(data.imageUrl ?? "")
      setCurrentImageSizeBytes(data.imageSizeBytes ?? 0)
      setRows(data.events.map(toReviewRow))
      setRereadOpen(false)
    } catch (err) {
      setRereadError(err instanceof Error ? err.message : "Re-read failed. Please try again.")
    } finally {
      setRereading(false)
    }
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected && r.title.trim())
    if (selected.length === 0) return
    setImporting(true)
    setError(null)
    try {
      // 1. Crea il record archivio prima degli eventi (per ottenere l'ID del SeendoUpload)
      const uploadRes = await fetch("/api/seendo/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: currentImageUrl,
          fileSizeBytes: currentImageSizeBytes || undefined,
          documentType: contextForm.documentType || undefined,
          referencePeriod: contextForm.referenceUnspecified
            ? undefined
            : `${contextForm.referenceText} (${contextForm.referencePeriod})`,
          timezone: contextForm.timezone || undefined,
          extractedEvents: events,
          importedEventIds: [],
        }),
      })
      if (!uploadRes.ok) throw new Error("Failed to save archive record")
      const upload = (await uploadRes.json()) as { id: string }

      // 2. Crea gli eventi con link al SeendoUpload sorgente
      const created = await Promise.all(
        selected.map(async (item) => {
          const isFullDay = item.isFullDay || !item.startTime
          let startIso: string
          let endIso: string
          if (isFullDay) {
            startIso = new Date(`${item.date}T00:00:00`).toISOString()
            endIso   = new Date(`${item.date}T23:59:00`).toISOString()
          } else {
            startIso = new Date(`${item.date}T${item.startTime}`).toISOString()
            endIso   = item.endTime
              ? new Date(`${item.date}T${item.endTime}`).toISOString()
              : new Date(new Date(`${item.date}T${item.startTime}`).getTime() + 3_600_000).toISOString()
          }
          const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: item.title.trim(),
              description: item.description ?? undefined,
              startTime: startIso,
              endTime: endIso,
              isFullDay,
              location: item.location ?? undefined,
              folderId: item.folderId ?? undefined,
              seendoSourceUploadId: upload.id,
              seendoImages: currentImageUrl ? [currentImageUrl] : undefined,
            }),
          })
          if (!res.ok) throw new Error("Failed to create event")
          return (await res.json()) as { id: string }
        })
      )

      const importedIds = created.map((e) => e.id)

      // 3. Aggiorna l'upload con gli ID degli eventi creati
      await fetch(`/api/seendo/uploads/${upload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importedEventIds: importedIds }),
      })

      await queryClient.invalidateQueries({ queryKey: ["events"] })
      onImported(importedIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed. Please try again.")
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
              {rows.length} events extracted — select those to import
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-smoke-500">
            <button
              onClick={() => selectAll(true)}
              className="hover:text-smoke-300 transition-colors"
            >
              All
            </button>
            <span>·</span>
            <button
              onClick={() => selectAll(false)}
              className="hover:text-smoke-300 transition-colors"
            >
              None
            </button>
          </div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {rows.length === 0 && (
            <p className="text-xs text-smoke-500 italic text-center py-6">
              No events found in the image.
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
                  placeholder="Event title…"
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
              <div className="flex items-center gap-2 px-3 pb-1.5 flex-wrap">
                <input
                  type="date"
                  value={row.date ?? ""}
                  onChange={(e) => updateRow(i, "date", e.target.value)}
                  className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold"
                />
                {row.isFullDay ? (
                  <button
                    type="button"
                    onClick={() => updateRow(i, "isFullDay", false)}
                    className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-doom-gold/80 hover:text-doom-gold focus:outline-none transition-colors"
                  >
                    All day
                  </button>
                ) : (
                  <>
                    <input
                      type="time"
                      value={row.startTime ?? ""}
                      onChange={(e) => updateRow(i, "startTime", e.target.value)}
                      placeholder="Start"
                      className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold w-24"
                    />
                    <span className="text-smoke-600 text-[10px]">–</span>
                    <input
                      type="time"
                      value={row.endTime ?? ""}
                      onChange={(e) => updateRow(i, "endTime", e.target.value)}
                      placeholder="End"
                      className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold w-24"
                    />
                    <button
                      type="button"
                      onClick={() => updateRow(i, "isFullDay", true)}
                      className="text-[10px] text-smoke-500 hover:text-doom-gold/70 focus:outline-none transition-colors"
                    >
                      All day
                    </button>
                  </>
                )}
                {row.description && (
                  <span className="text-[10px] text-smoke-600 italic truncate max-w-[200px]">
                    {row.description}
                  </span>
                )}
              </div>

              {/* Riga location */}
              <div className="flex items-center px-3 pb-2.5">
                <input
                  type="text"
                  value={row.location ?? ""}
                  onChange={(e) => updateRow(i, "location", e.target.value || null)}
                  placeholder="Location"
                  className="w-full bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 placeholder-smoke-600 focus:outline-none focus:border-doom-gold"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Errore import */}
        {error && (
          <p className="mx-4 mb-2 text-xs text-doom-ember bg-doom-ember/10 border border-doom-ember/30 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-smoke-700 shrink-0 flex flex-col gap-3">

          {/* Mini-form re-read — visibile solo quando rereadOpen */}
          {rereadOpen && (
            <div className="flex items-center gap-2 bg-smoke-800/60 rounded-lg px-3 py-2 border border-smoke-700">
              <span className="text-[10px] text-smoke-500 whitespace-nowrap shrink-0">Re-read with</span>
              <select
                value={rereadDifficulty}
                onChange={(e) =>
                  setRereadDifficulty(e.target.value as "low" | "medium" | "high")
                }
                disabled={rereading}
                className="flex-1 bg-smoke-700 border border-smoke-600 rounded px-2 py-1 text-xs text-smoke-200 focus:outline-none focus:border-doom-gold/50 disabled:opacity-40"
              >
                <option value="low">Low — poster / formatted text</option>
                <option value="medium">Medium — complex fonts</option>
                <option value="high">High — freehand handwriting</option>
              </select>
              <button
                onClick={handleReread}
                disabled={rereading}
                className="px-3 py-1.5 text-xs font-medium bg-navy-700 text-smoke-100 border border-navy-600 rounded-lg hover:bg-navy-600 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {rereading ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-smoke-300/30 border-t-smoke-300 rounded-full animate-spin" />
                    Reading…
                  </>
                ) : (
                  "Re-read with this model"
                )}
              </button>
              <button
                onClick={() => { setRereadOpen(false); setRereadError(null) }}
                disabled={rereading}
                className="text-smoke-500 hover:text-smoke-300 transition-colors text-lg leading-none disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          )}

          {/* Errore re-read */}
          {rereadError && (
            <p className="text-xs text-doom-ember bg-doom-ember/10 border border-doom-ember/30 rounded px-3 py-2">
              {rereadError}
            </p>
          )}

          {/* Azioni principali */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onDiscard}
              className="px-4 py-2 text-sm text-smoke-400 hover:text-smoke-200 transition-colors"
            >
              Discard all
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setRereadOpen((v) => !v); setRereadError(null) }}
                className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                  rereadOpen
                    ? "border-doom-gold/50 text-doom-gold/80 hover:text-doom-gold"
                    : "border-smoke-700 text-smoke-400 hover:text-smoke-200 hover:border-smoke-500"
                }`}
              >
                ↺ Re-read
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="px-5 py-2 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
                    Importing…
                  </>
                ) : (
                  `Import ${selectedCount} event${selectedCount !== 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
