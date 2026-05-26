"use client"

import { useState, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"

type Extracted = {
  title: string
  description: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
}

type ResultItem = {
  title: string
  description: string | null
  date: string
  startTime: string
  endTime: string
  selected: boolean
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toResultItem(e: Extracted): ResultItem {
  return {
    title: e.title ?? "",
    description: e.description ?? null,
    date: e.date ?? today(),
    startTime: e.startTime ?? "",
    endTime: e.endTime ?? "",
    selected: true,
  }
}

interface SeendoProps {
  onClose: () => void
}

export default function Seendo({ onClose }: SeendoProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState<ResultItem[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(f: File) {
    setFile(f)
    setResults(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith("image/")) handleFile(f)
  }, [])

  async function analyze() {
    if (!file) return
    setAnalyzing(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("image", file)
      const res = await fetch("/api/seendo", { method: "POST", body: form })
      if (!res.ok) throw new Error("Analysis failed")
      const data = (await res.json()) as { events: Extracted[] }
      setResults((data.events ?? []).map(toResultItem))
    } catch {
      setError("Failed to analyze the image. Please try again.")
    } finally {
      setAnalyzing(false)
    }
  }

  function toggleItem(i: number) {
    setResults((prev) => prev ? prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r) : prev)
  }

  function updateItem<K extends keyof ResultItem>(i: number, key: K, value: ResultItem[K]) {
    setResults((prev) => prev ? prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r) : prev)
  }

  async function addToGrid() {
    if (!results) return
    const selected = results.filter((r) => r.selected && r.title.trim())
    if (selected.length === 0) return
    setAdding(true)
    try {
      await Promise.all(
        selected.map((item) => {
          const startIso = item.startTime
            ? new Date(`${item.date}T${item.startTime}`).toISOString()
            : new Date(`${item.date}T09:00`).toISOString()
          const endIso = item.endTime
            ? new Date(`${item.date}T${item.endTime}`).toISOString()
            : new Date(`${item.date}T10:00`).toISOString()
          return fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: item.title.trim(),
              description: item.description ?? undefined,
              startTime: startIso,
              endTime: endIso,
            }),
          })
        })
      )
      await queryClient.invalidateQueries({ queryKey: ["events"] })
      onClose()
    } finally {
      setAdding(false)
    }
  }

  const selectedCount = results?.filter((r) => r.selected).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-smoke-700 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-smoke-100 uppercase tracking-widest">
              Seendo
            </h2>
            <p className="text-[10px] text-smoke-500 mt-0.5">AI agenda reader — upload a photo to extract events</p>
          </div>
          <button onClick={onClose} className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* Upload zone */}
          {!results && (
            <div
              className={`relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors cursor-pointer min-h-40 ${
                dragOver
                  ? "border-doom-gold bg-doom-gold/5"
                  : "border-smoke-600 hover:border-smoke-400 bg-smoke-800/40"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleInputChange}
              />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="max-h-48 max-w-full rounded object-contain" />
              ) : (
                <>
                  <span className="text-3xl text-smoke-600">📷</span>
                  <p className="text-xs text-smoke-400 text-center">
                    Drag & drop an image, or click to browse
                  </p>
                </>
              )}
            </div>
          )}

          {/* Thumbnail when results are shown */}
          {results && preview && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="w-14 h-14 rounded object-cover border border-smoke-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-smoke-200 truncate">{file?.name}</p>
                <button
                  onClick={() => { setFile(null); setPreview(null); setResults(null) }}
                  className="text-[10px] text-smoke-500 hover:text-doom-gold transition-colors mt-0.5"
                >
                  Upload a different image
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-doom-ember bg-doom-ember/10 border border-doom-ember/30 rounded px-3 py-2">{error}</p>
          )}

          {/* Results list */}
          {results && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-smoke-300 uppercase tracking-wider">
                  Extracted events ({results.length})
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setResults(results.map((r) => ({ ...r, selected: true })))}
                    className="text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setResults(results.map((r) => ({ ...r, selected: false })))}
                    className="text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors"
                  >
                    None
                  </button>
                </div>
              </div>

              {results.length === 0 && (
                <p className="text-xs text-smoke-500 italic">No events found in this image.</p>
              )}

              {results.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-lg border transition-colors ${
                    item.selected ? "border-smoke-600 bg-smoke-800/60" : "border-smoke-700/50 bg-smoke-800/20 opacity-50"
                  }`}
                >
                  {/* Title row */}
                  <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleItem(i)}
                      className="accent-doom-gold shrink-0"
                    />
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateItem(i, "title", e.target.value)}
                      className="flex-1 bg-transparent text-xs text-smoke-100 focus:outline-none min-w-0"
                      placeholder="Event title..."
                    />
                  </div>

                  {/* Date + time row */}
                  <div className="flex items-center gap-2 px-3 pb-2.5 flex-wrap">
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) => updateItem(i, "date", e.target.value)}
                      className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold"
                    />
                    <input
                      type="time"
                      value={item.startTime}
                      onChange={(e) => updateItem(i, "startTime", e.target.value)}
                      placeholder="Start"
                      className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold w-24"
                    />
                    <span className="text-smoke-600 text-[10px]">–</span>
                    <input
                      type="time"
                      value={item.endTime}
                      onChange={(e) => updateItem(i, "endTime", e.target.value)}
                      placeholder="End"
                      className="bg-smoke-700 border border-smoke-600 rounded px-2 py-0.5 text-[10px] text-smoke-200 focus:outline-none focus:border-doom-gold w-24"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-smoke-700 shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-smoke-400 hover:text-smoke-200 transition-colors"
          >
            Cancel
          </button>

          {!results ? (
            <button
              onClick={analyze}
              disabled={!file || analyzing}
              className="px-5 py-2 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze image"
              )}
            </button>
          ) : (
            <button
              onClick={addToGrid}
              disabled={selectedCount === 0 || adding}
              className="px-5 py-2 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors flex items-center gap-2"
            >
              {adding ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                `Add ${selectedCount} event${selectedCount !== 1 ? "s" : ""} to grid`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
