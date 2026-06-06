"use client"

import { useState, useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import type { SeendoFile, ApiSeendoUpload } from "@/types"

const MAX_SIZE_BYTES = 10 * 1024 * 1024

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <span className="text-doom-gold">⬛</span>
  if (type === "application/pdf") return <span className="text-doom-ember">▣</span>
  return <span className="text-smoke-400">▤</span>
}

interface SeendoEventTabProps {
  eventId: string
  seendoSourceUploadId?: string | null
  seendoImages?: string[] | null
  initialFiles?: SeendoFile[] | null
}

export default function SeendoEventTab({
  eventId,
  seendoSourceUploadId,
  seendoImages,
  initialFiles,
}: SeendoEventTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<SeendoFile[]>(initialFiles ?? [])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Recupera i metadati dell'upload sorgente (data importazione)
  const { data: sourceUpload } = useQuery<ApiSeendoUpload>({
    queryKey: ["seendo-upload", seendoSourceUploadId],
    queryFn: () =>
      fetch(`/api/seendo/uploads/${seendoSourceUploadId}`).then((r) => r.json()),
    enabled: !!seendoSourceUploadId,
    staleTime: 5 * 60 * 1000,
  })

  const sourceImageUrl = seendoImages?.[0] ?? null

  async function handleFileUpload(file: File) {
    setError(null)
    if (file.size > MAX_SIZE_BYTES) {
      setError("File exceeds the 10 MB limit.")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("eventId", eventId)
      const res = await fetch("/api/seendo/event-files", { method: "POST", body: fd })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Upload failed")
      }
      const data = (await res.json()) as { file: SeendoFile }
      setFiles((prev) => [...prev, data.file])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(target: SeendoFile) {
    setError(null)
    try {
      const res = await fetch(
        `/api/seendo/event-files/${target.key}?eventId=${eventId}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error("Deletion failed")
      setFiles((prev) => prev.filter((f) => f.key !== target.key))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed.")
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) void handleFileUpload(f)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId],
  )

  return (
    <div className="flex flex-col gap-4 px-4 py-3">

      {/* Sezione immagine sorgente OCR */}
      {sourceImageUrl && seendoSourceUploadId && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-smoke-500 uppercase tracking-wider">Source image</p>
          <div className="flex items-start gap-3">
            {/* Thumbnail */}
            <button
              type="button"
              onClick={() => setLightboxUrl(sourceImageUrl)}
              className="shrink-0 w-20 h-20 rounded-lg border border-smoke-700 overflow-hidden hover:border-doom-gold/50 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sourceImageUrl}
                alt="OCR source image"
                className="w-full h-full object-cover"
              />
            </button>
            <div className="flex flex-col gap-0.5 pt-1">
              <p className="text-xs text-smoke-300">Imported via Seendo</p>
              {sourceUpload && (
                <p className="text-[10px] text-smoke-500">
                  {new Date(sourceUpload.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sezione file allegati */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] text-smoke-500 uppercase tracking-wider">Attached files</p>

        {files.length > 0 && (
          <div className="flex flex-col divide-y divide-smoke-800 rounded-lg border border-smoke-700 overflow-hidden">
            {files.map((f) => (
              <div key={f.key} className="flex items-center gap-3 px-3 py-2">
                <FileIcon type={f.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-smoke-200 truncate">{f.name}</p>
                  <p className="text-[10px] text-smoke-600">{formatSize(f.size)}</p>
                </div>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-smoke-500 hover:text-doom-gold transition-colors shrink-0"
                  title="Download"
                >
                  ↓
                </a>
                <button
                  type="button"
                  onClick={() => void handleDelete(f)}
                  className="text-[10px] text-smoke-600 hover:text-doom-ember transition-colors shrink-0"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Zona upload */}
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors min-h-[72px] ${
            dragOver
              ? "border-doom-gold bg-doom-gold/10"
              : "border-smoke-600 hover:border-doom-gold/50 bg-smoke-800/50"
          } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFileUpload(f)
              e.target.value = ""
            }}
          />
          {uploading ? (
            <div className="flex items-center gap-2 text-[10px] text-smoke-300">
              <span className="inline-block w-3 h-3 border-2 border-smoke-600 border-t-doom-gold rounded-full animate-spin" />
              Uploading…
            </div>
          ) : (
            <>
              <span className="text-doom-gold/70 text-base leading-none">↑</span>
              <p className="text-[10px] text-smoke-300 text-center">
                Attach files — click or drop here (max 10 MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Errore */}
      {error && (
        <p className="text-xs text-doom-ember bg-doom-ember/10 border border-doom-ember/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Lightbox immagine sorgente */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/90 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="OCR source image — full screen"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-smoke-300 hover:text-smoke-100 text-2xl leading-none"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
