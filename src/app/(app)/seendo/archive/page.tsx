"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import type { ApiSeendoUpload, SeendoExtractedEvent } from "@/types"

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
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

  const events = upload.extractedEvents

  async function importLater(event: SeendoExtractedEvent, idx: number) {
    if (importingIdx !== null) return
    setImportingIdx(idx)
    try {
      const startIso = event.startTime
        ? new Date(`${event.date ?? new Date().toISOString().slice(0, 10)}T${event.startTime}`).toISOString()
        : new Date(`${event.date ?? new Date().toISOString().slice(0, 10)}T09:00`).toISOString()
      const endIso = event.endTime
        ? new Date(`${event.date ?? new Date().toISOString().slice(0, 10)}T${event.endTime}`).toISOString()
        : new Date(`${event.date ?? new Date().toISOString().slice(0, 10)}T10:00`).toISOString()

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: event.title, startTime: startIso, endTime: endIso }),
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
            {upload.documentType || "Documento sconosciuto"}
          </p>
          <p className="text-[10px] text-smoke-500 mt-0.5">
            {upload.referencePeriod
              ? `Periodo: ${upload.referencePeriod}`
              : "Periodo non specificato"}
            {upload.timezone ? ` · ${upload.timezone}` : ""}
          </p>
          <p className="text-[10px] text-smoke-600 mt-0.5">{fmtDate(upload.createdAt)}</p>
        </div>
        <div className="text-[10px] text-smoke-600 shrink-0">
          {upload.importedEventIds.length}/{events.length} importati
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
                  {importingIdx === i ? "…" : "Importa"}
                </button>
              )}
            </div>
          )
        })}

        {events.length === 0 && (
          <p className="px-4 py-3 text-[10px] text-smoke-600 italic">
            Nessun evento estratto per questo upload.
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
          <h1 className="text-sm font-semibold text-smoke-100">Seendo — Archive</h1>
          <p className="text-[10px] text-smoke-500 mt-0.5">
            Storico delle immagini analizzate
          </p>
        </div>
        <Link
          href="/seendo"
          className="text-[10px] text-smoke-500 hover:text-smoke-200 transition-colors"
        >
          ← Torna a Seendo
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl w-full mx-auto">
        {isLoading && (
          <p className="text-xs text-smoke-500 text-center py-8">Caricamento…</p>
        )}

        {!isLoading && uploads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-smoke-500 text-xs">Nessun upload nell&apos;archivio.</p>
            <Link
              href="/seendo"
              className="mt-3 inline-block text-[10px] text-doom-gold hover:text-doom-gold/70 transition-colors"
            >
              Vai a Seendo per analizzare un&apos;immagine →
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
