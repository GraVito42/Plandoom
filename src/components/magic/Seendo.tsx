"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import SeendoReview from "./SeendoReview"
import SeendoLogo from "./SeendoLogo"
import { getSeendoBudgetStatus, getSeendoResetDate } from "@/lib/seendo-budget"
import { SEENDO_DAILY_CALL_LIMIT } from "@/lib/seendo-limits"
import type {
  SeendoBudgetStatus,
  SeendoExtractedEvent,
  SeendoContextForm,
  ApiMe,
} from "@/types"

// ── Fusi orari ────────────────────────────────────────────────────────────────

const COMMON_TIMEZONES = [
  "Europe/Rome",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Africa/Cairo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
]

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
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

// ── Stato exhausted — pulsante toggle linea di reset ─────────────────────────

const LS_SEENDO_RESET_LINE = "plandoom_seendo_reset_line"

function ExhaustedState({ resetDate, status }: { resetDate: Date; status: SeendoBudgetStatus }) {
  const [lineActive, setLineActive] = useState(false)

  useEffect(() => {
    setLineActive(localStorage.getItem(LS_SEENDO_RESET_LINE) === "true")
  }, [])

  function toggleResetLine() {
    const next = !lineActive
    setLineActive(next)
    localStorage.setItem(LS_SEENDO_RESET_LINE, String(next))
    // Notifica il WeekGrid tramite storage event
    window.dispatchEvent(new StorageEvent("storage", { key: LS_SEENDO_RESET_LINE }))
  }

  const resetFormatted = resetDate.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex flex-col items-center gap-4 mt-2 w-full">
      <p className="text-xs text-smoke-500 text-center max-w-xs">
        {status === "call_exhausted" ? (
          <>
            Daily read limit reached ({SEENDO_DAILY_CALL_LIMIT}/{SEENDO_DAILY_CALL_LIMIT}).{" "}
            <span className="text-smoke-300">Try again tomorrow.</span>
          </>
        ) : (
          <>
            Monthly Seendo budget exhausted. Resets on{" "}
            <span className="text-smoke-300">{resetFormatted}</span>.
          </>
        )}
      </p>
      <button
        onClick={toggleResetLine}
        className={`flex items-center gap-2.5 px-4 py-2 rounded-lg border text-xs transition-colors ${
          lineActive
            ? "border-doom-ember/60 bg-doom-ember/10 text-doom-ember/80"
            : "border-smoke-700 bg-smoke-800/40 text-smoke-400 hover:text-smoke-200 hover:border-smoke-600"
        }`}
      >
        <SeendoLogo size="sm" />
        {lineActive ? "Hide reset date on grid" : "Show reset date on grid"}
      </button>
      <Link
        href="/seendo/archive"
        className="text-[10px] text-smoke-600 hover:text-smoke-400 transition-colors"
      >
        Upload archive →
      </Link>
    </div>
  )
}

// ── Etichette stato budget ────────────────────────────────────────────────────

const STATUS_LABELS: Record<SeendoBudgetStatus, string> = {
  active:         "Active",
  restricted:     "With restrictions",
  exhausted:      "Not active",
  call_exhausted: "Not active",
}

// ── Pannello Seendo — contenuto principale ────────────────────────────────────
// Usato sia come modale sopra la WeekGrid che come pagina standalone /seendo

export function SeendoPanel({ onClose }: { onClose?: () => void }) {
  const { data: budgetStatus = "active" } = useQuery<SeendoBudgetStatus>({
    queryKey: ["seendo-budget"],
    queryFn: () => getSeendoBudgetStatus(""),
    staleTime: 5 * 60 * 1000,
  })

  const { data: me } = useQuery<ApiMe>({
    queryKey: ["me"],
    queryFn: () => fetch("/api/me").then((r) => r.json() as Promise<ApiMe>),
    staleTime: 5 * 60 * 1000,
  })

  // Stato forzato dal pannello debug admin (null = usa valore reale)
  const [debugStatus, setDebugStatus] = useState<SeendoBudgetStatus | "admin" | null>(null)

  // "admin" non altera il budget status del pannello, solo il colore del logo
  const effectiveBudgetStatus: SeendoBudgetStatus =
    debugStatus !== null && debugStatus !== "admin" ? debugStatus : budgetStatus

  const resetDate = getSeendoResetDate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedEvents, setExtractedEvents] = useState<SeendoExtractedEvent[] | null>(null)
  const [imageUrl, setImageUrl] = useState<string>("")
  const [imageSizeBytes, setImageSizeBytes] = useState(0)

  const [form, setForm] = useState<SeendoContextForm>({
    referenceText: "",
    referencePeriod: "week",
    referenceUnspecified: false,
    timezone: getBrowserTimezone(),
    documentType: "",
    furtherInstructions: "",
    difficulty: "medium",
  })

  function patchForm(updates: Partial<SeendoContextForm>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  // Auto-reset difficulty a "medium" se diventa restricted mentre "high" è selezionato
  useEffect(() => {
    if (effectiveBudgetStatus === "restricted" && form.difficulty === "high") {
      patchForm({ difficulty: "medium" })
    }
  }, [effectiveBudgetStatus, form.difficulty])

  function handleFile(f: File) {
    setFile(f)
    setExtractedEvents(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith("image/")) handleFile(f)
  }, [])

  async function avviaLettura() {
    if (!file) return
    setAnalyzing(true)
    setError(null)
    try {
      const imageToSend = form.difficulty === "low" ? await compressImageToLow(file) : file
      const fd = new FormData()
      fd.append("image", imageToSend)
      fd.append("referenceText", form.referenceText)
      fd.append("referencePeriod", form.referencePeriod)
      fd.append("referenceUnspecified", String(form.referenceUnspecified))
      fd.append("timezone", form.timezone)
      fd.append("documentType", form.documentType)
      fd.append("furtherInstructions", form.furtherInstructions)
      fd.append("difficulty", form.difficulty)

      const res = await fetch("/api/seendo", { method: "POST", body: fd })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Analysis failed")
      }
      const data = (await res.json()) as { events: SeendoExtractedEvent[]; imageUrl: string; imageSizeBytes: number }
      setImageUrl(data.imageUrl ?? "")
      setImageSizeBytes(data.imageSizeBytes ?? 0)
      setExtractedEvents(data.events ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.")
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="flex flex-col items-center py-6 px-5 gap-5">

      {/* Logo + status — centrato e grande */}
      <div className="flex flex-col items-center gap-3">
        <SeendoLogo size="xl" debugStatus={debugStatus ?? undefined} />
        <div className="text-center">
          <p className="text-sm font-semibold text-smoke-100 uppercase tracking-widest">Seendo</p>
          <p
            className={`text-[10px] uppercase tracking-widest ${
              effectiveBudgetStatus === "active"
                ? "text-green-400"
                : effectiveBudgetStatus === "restricted"
                ? "text-amber-400"
                : "text-doom-ember/80"
            }`}
          >
            {STATUS_LABELS[effectiveBudgetStatus]}
          </p>
        </div>
      </div>

      {/* Pannello debug — visibile solo per admin */}
      {me?.role === "admin" && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-widest text-doom-ember/60">debug</span>
          <div className="flex gap-1">
            {(["active", "restricted", "exhausted", "call_exhausted", "admin"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDebugStatus((prev) => prev === s ? null : s)}
                className={`px-2 py-0.5 text-[9px] rounded border transition-colors ${
                  debugStatus === s
                    ? "border-doom-gold/60 text-doom-gold"
                    : "border-smoke-700 text-smoke-500 hover:text-smoke-300 hover:border-smoke-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stato esaurito (token o chiamate) */}
      {(effectiveBudgetStatus === "exhausted" || effectiveBudgetStatus === "call_exhausted") && (
        <ExhaustedState resetDate={resetDate} status={effectiveBudgetStatus} />
      )}

      {/* Stato attivo o restricted */}
      {effectiveBudgetStatus !== "exhausted" && effectiveBudgetStatus !== "call_exhausted" && (
        <div className="w-full flex flex-col gap-4">

          {/* Upload zone */}
          <div
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors min-h-36 ${
              dragOver
                ? "border-doom-gold bg-doom-gold/5"
                : "border-smoke-600 hover:border-smoke-400 bg-smoke-800/30"
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
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Image preview"
                className="max-h-40 max-w-full rounded-lg object-contain"
              />
            ) : (
              <>
                <span className="text-2xl text-smoke-600">+</span>
                <p className="text-sm font-medium text-doom-gold uppercase tracking-widest">
                  Add Photo
                </p>
                <p className="text-[10px] text-smoke-500 text-center">
                  Drag an image or click to browse
                </p>
              </>
            )}
          </div>

          {file && (
            <button
              onClick={() => { setFile(null); setPreview(null) }}
              className="text-[10px] text-smoke-600 hover:text-smoke-400 self-end transition-colors"
            >
              Remove image
            </button>
          )}

          {/* Form di contesto */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-smoke-700 bg-smoke-900/50">
            <p className="text-[10px] text-smoke-500 uppercase tracking-wider">Reading context</p>

            {/* Reference */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-smoke-500">Reference</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.referenceText}
                  onChange={(e) => patchForm({ referenceText: e.target.value })}
                  disabled={form.referenceUnspecified}
                  placeholder="07/05 – 12/05"
                  className="flex-1 bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 placeholder:text-smoke-600 focus:outline-none focus:border-doom-gold/50 disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <select
                  value={form.referencePeriod}
                  onChange={(e) =>
                    patchForm({
                      referencePeriod: e.target.value as SeendoContextForm["referencePeriod"],
                    })
                  }
                  disabled={form.referenceUnspecified}
                  className="bg-smoke-800 border border-smoke-600 rounded px-2 py-1.5 text-xs text-smoke-200 focus:outline-none focus:border-doom-gold/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
                <label className="flex items-center gap-1.5 text-[10px] text-smoke-400 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={form.referenceUnspecified}
                    onChange={(e) => patchForm({ referenceUnspecified: e.target.checked })}
                    className="accent-doom-gold"
                  />
                  Don&apos;t specify
                </label>
              </div>
            </div>

            {/* Time zone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-smoke-500">Time zone</label>
              <select
                value={form.timezone}
                onChange={(e) => patchForm({ timezone: e.target.value })}
                className="bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-200 focus:outline-none focus:border-doom-gold/50"
              >
                {!COMMON_TIMEZONES.includes(form.timezone) && (
                  <option value={form.timezone}>{form.timezone} (rilevato)</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-smoke-500">Type</label>
              <input
                type="text"
                value={form.documentType}
                onChange={(e) => patchForm({ documentType: e.target.value })}
                placeholder="Weekly Moleskine Agenda, University timetable, Concert poster"
                className="bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 placeholder:text-smoke-600 focus:outline-none focus:border-doom-gold/50"
              />
            </div>

            {/* Reading Difficulty */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-smoke-500">Reading Difficulty</label>
              <select
                value={form.difficulty}
                onChange={(e) =>
                  patchForm({ difficulty: e.target.value as SeendoContextForm["difficulty"] })
                }
                className="bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-200 focus:outline-none focus:border-doom-gold/50"
              >
                <option value="low">Low — poster or well-formatted text</option>
                <option value="medium">Medium — original formatting, complex fonts</option>
                <option value="high" disabled={effectiveBudgetStatus === "restricted"}>
                  High — freehand handwriting
                </option>
              </select>
              {effectiveBudgetStatus === "restricted" && (
                <p className="text-[10px] text-doom-ember">
                  High model unavailable in restricted mode
                </p>
              )}
            </div>

            {/* Further instructions */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-smoke-500">Further instructions</label>
              <textarea
                value={form.furtherInstructions}
                onChange={(e) => patchForm({ furtherInstructions: e.target.value })}
                placeholder="Ignore margin notes, The arrow → means duration, Handwriting is in Italian"
                rows={2}
                className="bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 placeholder:text-smoke-600 focus:outline-none focus:border-doom-gold/50 resize-none"
              />
            </div>
          </div>

          {/* Errore */}
          {error && (
            <p className="text-xs text-doom-ember bg-doom-ember/10 border border-doom-ember/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={avviaLettura}
            disabled={!file || analyzing}
            className="w-full py-2.5 text-sm font-semibold uppercase tracking-widest bg-doom-gold text-navy-950 rounded-xl hover:bg-doom-gold/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
                Analyzing…
              </>
            ) : (
              "Start Reading"
            )}
          </button>

          <Link
            href="/seendo/archive"
            className="text-[10px] text-smoke-600 hover:text-smoke-400 transition-colors text-center"
          >
            Upload archive →
          </Link>
        </div>
      )}

      {/* Review eventi estratti */}
      {extractedEvents !== null && (
        <SeendoReview
          events={extractedEvents}
          contextForm={form}
          imageFile={file}
          imageUrl={imageUrl}
          imageSizeBytes={imageSizeBytes}
          difficulty={form.difficulty}
          onImported={() => {
            setExtractedEvents(null)
            setFile(null)
            setPreview(null)
            setImageUrl("")
            setImageSizeBytes(0)
            onClose?.()
          }}
          onDiscard={() => setExtractedEvents(null)}
        />
      )}
    </div>
  )
}

// ── Modale Seendo — overlay sopra la WeekGrid ─────────────────────────────────

export default function Seendo({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Pannello */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header minimale con pulsante chiudi */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-smoke-700 shrink-0">
          <p className="text-[10px] text-smoke-500 uppercase tracking-wider">
            AI agenda reader
          </p>
          <button
            onClick={onClose}
            className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Contenuto scrollabile */}
        <div className="flex-1 overflow-y-auto">
          <SeendoPanel onClose={onClose} />
        </div>
      </div>
    </div>
  )
}
