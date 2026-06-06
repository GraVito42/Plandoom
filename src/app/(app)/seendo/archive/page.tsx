"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import type { ApiSeendoUpload, SeendoExtractedEvent } from "@/types"
import SeendoLogo from "@/components/magic/SeendoLogo"

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ── UploadCard ─────────────────────────────────────────────────────────────────

function UploadCard({ upload }: { upload: ApiSeendoUpload }) {
  const queryClient = useQueryClient()
  const [importingIdx, setImportingIdx] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/seendo/uploads/${upload.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      queryClient.setQueryData<ApiSeendoUpload[]>(["seendo-uploads"], (prev) =>
        (prev ?? []).filter((u) => u.id !== upload.id)
      )
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const events = upload.extractedEvents

  async function importLater(event: SeendoExtractedEvent, idx: number) {
    if (importingIdx !== null) return
    setImportingIdx(idx)
    try {
      const dateStr = event.date ?? new Date().toISOString().slice(0, 10)
      // Stessa logica full-day del flusso OCR (SeendoReview)
      const isFullDay = !event.startTime
      let startIso: string
      let endIso: string
      if (isFullDay) {
        startIso = new Date(`${dateStr}T00:00:00`).toISOString()
        endIso   = new Date(`${dateStr}T23:59:00`).toISOString()
      } else {
        startIso = new Date(`${dateStr}T${event.startTime}`).toISOString()
        endIso   = event.endTime
          ? new Date(`${dateStr}T${event.endTime}`).toISOString()
          : new Date(new Date(`${dateStr}T${event.startTime}`).getTime() + 3_600_000).toISOString()
      }

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          description: event.description ?? undefined,
          startTime: startIso,
          endTime: endIso,
          isFullDay,
          location: event.location ?? undefined,
          seendoSourceUploadId: upload.id,
          seendoImages: upload.imageUrl ? [upload.imageUrl] : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const created = (await res.json()) as { id: string }

      // Aggiorna importedEventIds nell'upload
      await fetch(`/api/seendo/uploads/${upload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importedEventIds: [...upload.importedEventIds, created.id],
        }),
      })
      await queryClient.invalidateQueries({ queryKey: ["seendo-uploads"] })
      await queryClient.invalidateQueries({ queryKey: ["events"] })
    } finally {
      setImportingIdx(null)
    }
  }

  return (
    <div className="rounded-xl border border-smoke-700 bg-smoke-900/40 overflow-hidden">
      {/* Intestazione upload */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-smoke-800">
        {/* Thumbnail placeholder */}
        <div className="w-12 h-12 rounded-lg bg-smoke-800 border border-smoke-700 shrink-0 flex items-center justify-center text-smoke-600 text-[10px]">
          IMG
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-smoke-100 font-medium">
            {upload.documentType || "Unknown document"}
          </p>
          <p className="text-[10px] text-smoke-500 mt-0.5">
            {upload.referencePeriod
              ? `Period: ${upload.referencePeriod}`
              : "Period not specified"}
            {upload.timezone ? ` · ${upload.timezone}` : ""}
          </p>
          <p className="text-[10px] text-smoke-600 mt-0.5">{fmtDate(upload.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-smoke-600">
            {upload.importedEventIds.length}/{events.length} imported
          </span>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[10px] text-smoke-600 hover:text-doom-ember transition-colors"
            >
              Delete
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] text-smoke-400 text-right max-w-[160px]">
                Delete this scan? Imported events will not be affected.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-[10px] text-smoke-500 hover:text-smoke-200 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[10px] text-doom-ember hover:text-doom-ember/70 transition-colors disabled:opacity-40"
                >
                  {deleting ? "…" : "Confirm"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lista eventi estratti */}
      <div className="flex flex-col divide-y divide-smoke-800">
        {events.map((event, i) => {
          // Un evento è "importato" se il suo indice corrisponde a un ID importato.
          // Poiché non conosciamo l'indice → ID mapping, usiamo un'euristica:
          // i primi importedEventIds.length eventi nella lista sono considerati importati.
          const isImported = i < upload.importedEventIds.length

          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                isImported ? "" : "opacity-60"
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${isImported ? 'bg-green-500' : 'bg-smoke-600'}">
                <div
                  className={`w-full h-full rounded-full ${
                    isImported ? "bg-green-500" : "bg-smoke-600"
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs ${
                    isImported ? "text-smoke-200" : "text-smoke-400 line-through"
                  }`}
                >
                  {event.title}
                </p>
                <p className="text-[10px] text-smoke-600">
                  {event.date ?? "—"}
                  {event.startTime ? ` · ${event.startTime}` : ""}
                  {event.endTime ? ` – ${event.endTime}` : ""}
                </p>
              </div>
              {!isImported && (
                <button
                  onClick={() => importLater(event, i)}
                  disabled={importingIdx === i}
                  className="text-[10px] text-doom-gold hover:text-doom-gold/70 transition-colors disabled:opacity-40 shrink-0"
                >
                  {importingIdx === i ? "…" : "Import"}
                </button>
              )}
            </div>
          )
        })}

        {events.length === 0 && (
          <p className="px-4 py-3 text-[10px] text-smoke-600 italic">
            No events extracted for this upload.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Archive page ──────────────────────────────────────────────────────────────

export default function SeendoArchivePage() {
  const { data: uploads = [], isLoading } = useQuery<ApiSeendoUpload[]>({
    queryKey: ["seendo-uploads"],
    queryFn: () => fetch("/api/seendo/uploads").then((r) => r.json()),
    staleTime: 60_000,
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 border-b border-smoke-800 px-6 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SeendoLogo size="sm" />
            <h1 className="text-sm font-semibold text-smoke-100">Seendo — Archive</h1>
          </div>
          <p className="text-[10px] text-smoke-500 mt-0.5">
            History of analyzed images
          </p>
        </div>
        <Link
          href="/seendo"
          className="text-[10px] text-smoke-500 hover:text-smoke-200 transition-colors"
        >
          ← Back to Seendo
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl w-full mx-auto">
        {isLoading && (
          <p className="text-xs text-smoke-500 text-center py-8">Loading…</p>
        )}

        {!isLoading && uploads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-smoke-500 text-xs">No uploads in the archive.</p>
            <Link
              href="/seendo"
              className="mt-3 inline-block text-[10px] text-doom-gold hover:text-doom-gold/70 transition-colors"
            >
              Go to Seendo to analyze an image →
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {uploads.map((u) => (
            <UploadCard key={u.id} upload={u} />
          ))}
        </div>
      </div>
    </div>
  )
}
