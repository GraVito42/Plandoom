"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import SeendoReview from "@/components/magic/SeendoReview"
import { getSeendoBudgetStatus, getSeendoResetDate } from "@/lib/seendo-budget"
import type {
  SeendoBudgetStatus,
  SeendoExtractedEvent,
  SeendoContextForm,
} from "@/types"

// ── Logo Seendo SVG ───────────────────────────────────────────────────────────

const DOT_COLORS: Record<SeendoBudgetStatus, string> = {
  active: "#4ade80",
  restricted: "#f59e0b",
  exhausted: "#ef4444",
}

function SeendoLogo({
  budgetStatus,
  size = 96,
}: {
  budgetStatus: SeendoBudgetStatus
  size?: number
}) {
  const dotColor = DOT_COLORS[budgetStatus]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Seendo logo"
    >
      {/* Triangolo esterno */}
      <polygon
        points="50,8 96,88 4,88"
        stroke="#c9a84c"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="rgba(10,22,40,0.85)"
      />
      {/* Occhio — sclera */}
      <ellipse cx="50" cy="60" rx="22" ry="14" fill="rgba(22,45,94,0.7)" stroke="#c9a84c" strokeWidth="1.5" />
      {/* Iride */}
      <ellipse cx="50" cy="60" rx="10" ry="10" fill="#0a1628" />
      {/* Pupilla — dot colorato in base allo stato budget */}
      <circle cx="50" cy="60" r="5" fill={dotColor} />
      {/* Riflesso */}
      <circle cx="53" cy="57" r="1.5" fill="rgba(255,255,255,0.6)" />
    </svg>
  )
}

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

// ── Stato exhausted — pulsante reset line ─────────────────────────────────────

const LS_SEENDO_RESET_LINE = "plandoom_seendo_reset_line"

function ExhaustedState({ resetDate }: { resetDate: Date }) {
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
    <div className="flex flex-col items-center gap-4 mt-2">
      <p className="text-xs text-smoke-500 text-center max-w-xs">
        Budget mensile Seendo esaurito. Si ricarica il{" "}
        <span className="text-smoke-300">{resetFormatted}</span>.
      </p>
      <button
        onClick={toggleResetLine}
        className={`flex items-center gap-2.5 px-4 py-2 rounded-lg border text-xs transition-colors ${
          lineActive
            ? "border-red-700/60 bg-red-900/20 text-red-400"
            : "border-smoke-700 bg-smoke-800/40 text-smoke-400 hover:text-smoke-200 hover:border-smoke-600"
        }`}
      >
        {/* Mini triangolo con stile Seendo */}
        <svg width="14" height="14" viewBox="0 0 100 100" fill="none">
          <polygon
            points="50,8 96,88 4,88"
            stroke={lineActive ? "#ef4444" : "#6b7280"}
            strokeWidth="6"
            fill="none"
          />
          <circle cx="50" cy="62" r="12" fill={lineActive ? "#ef4444" : "#6b7280"} />
        </svg>
        {lineActive ? "Nascondi data ricarica sulla griglia" : "Mostra data ricarica sulla griglia"}
      </button>
      <Link
        href="/seendo/archive"
        className="text-[10px] text-smoke-600 hover:text-smoke-400 transition-colors"
      >
        Archivio upload →
      </Link>
    </div>
  )
}

// ── Stato principale ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<SeendoBudgetStatus, string> = {
  active: "Active",
  restricted: "With restrictions",
  exhausted: "Not active",
}

export default function SeendoPage() {
  const { data: budgetStatus = "active" } = useQuery<SeendoBudgetStatus>({
    queryKey: ["seendo-budget"],
    queryFn: () => getSeendoBudgetStatus(""),
    staleTime: 5 * 60 * 1000,
  })

  const resetDate = getSeendoResetDate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extractedEvents, setExtractedEvents] = useState<SeendoExtractedEvent[] | null>(null)

  const [form, setForm] = useState<SeendoContextForm>({
    referenceText: "",
    referencePeriod: "week",
    referenceUnspecified: false,
    timezone: getBrowserTimezone(),
    documentType: "",
    furtherInstructions: "",
  })

  function patchForm(updates: Partial<SeendoContextForm>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

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
      const fd = new FormData()
      fd.append("image", file)
      fd.append("referenceText", form.referenceText)
      fd.append("referencePeriod", form.referencePeriod)
      fd.append("referenceUnspecified", String(form.referenceUnspecified))
      fd.append("timezone", form.timezone)
      fd.append("documentType", form.documentType)
      fd.append("furtherInstructions", form.furtherInstructions)

      const res = await fetch("/api/seendo", { method: "POST", body: fd })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Analisi fallita")
      }
      const data = (await res.json()) as { events: SeendoExtractedEvent[] }
      setExtractedEvents(data.events ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analisi fallita. Riprova.")
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="flex flex-col items-center min-h-full bg-navy-950 py-10 px-4 overflow-y-auto">

      {/* Logo + status */}
      <div className="flex flex-col items-center gap-2 mb-8">
        <SeendoLogo budgetStatus={budgetStatus} size={96} />
        <p className="text-xs text-smoke-400 uppercase tracking-widest">
          Seendo:{" "}
          <span
            className={
              budgetStatus === "active"
                ? "text-green-400"
                : budgetStatus === "restricted"
                ? "text-amber-400"
                : "text-red-400"
            }
          >
            {STATUS_LABELS[budgetStatus]}
          </span>
        </p>
      </div>

      {/* Stato esaurito */}
      {budgetStatus === "exhausted" && <ExhaustedState resetDate={resetDate} />}

      {/* Stato attivo o restricted */}
      {budgetStatus !== "exhausted" && (
        <div className="w-full max-w-md flex flex-col gap-5">

          {/* Upload zone */}
          <div
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors min-h-44 ${
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
                alt="Anteprima"
                className="max-h-52 max-w-full rounded-lg object-contain"
              />
            ) : (
              <>
                <span className="text-2xl text-smoke-600">+</span>
                <p className="text-sm font-medium text-doom-gold uppercase tracking-widest">
                  Add Photo
                </p>
                <p className="text-[10px] text-smoke-500 text-center">
                  Trascina un&apos;immagine o clicca per sfogliare
                </p>
              </>
            )}
          </div>

          {file && (
            <button
              onClick={() => { setFile(null); setPreview(null) }}
              className="text-[10px] text-smoke-600 hover:text-smoke-400 self-end transition-colors"
            >
              Rimuovi immagine
            </button>
          )}

          {/* Form di contesto */}
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-smoke-700 bg-smoke-900/50">
            <p className="text-[10px] text-smoke-500 uppercase tracking-wider">
              Contesto lettura
            </p>

            {/* Riga 1 — Reference */}
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
                  <option value="day">Giorno</option>
                  <option value="week">Settimana</option>
                  <option value="month">Mese</option>
                  <option value="year">Anno</option>
                </select>
                <label className="flex items-center gap-1.5 text-[10px] text-smoke-400 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={form.referenceUnspecified}
                    onChange={(e) => patchForm({ referenceUnspecified: e.target.checked })}
                    className="accent-doom-gold"
                  />
                  Non specificare
                </label>
              </div>
            </div>

            {/* Riga 2 — Time zone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-smoke-500">Time zone</label>
              <select
                value={form.timezone}
                onChange={(e) => patchForm({ timezone: e.target.value })}
                className="bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-200 focus:outline-none focus:border-doom-gold/50"
              >
                {/* Mostra il fuso del browser se non è nella lista comune */}
                {!COMMON_TIMEZONES.includes(form.timezone) && (
                  <option value={form.timezone}>{form.timezone} (rilevato)</option>
                )}
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {/* Riga 3 — Type */}
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

            {/* Riga 4 — Further instructions */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-smoke-500">Further instructions</label>
              <textarea
                value={form.furtherInstructions}
                onChange={(e) => patchForm({ furtherInstructions: e.target.value })}
                placeholder="Ignore margin notes, The arrow → means duration, Handwriting is in Italian"
                rows={3}
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
                Analisi in corso…
              </>
            ) : (
              "Avvia Lettura"
            )}
          </button>

          <Link
            href="/seendo/archive"
            className="text-[10px] text-smoke-600 hover:text-smoke-400 transition-colors text-center"
          >
            Archivio upload →
          </Link>
        </div>
      )}

      {/* Modale review */}
      {extractedEvents !== null && (
        <SeendoReview
          events={extractedEvents}
          contextForm={form}
          imageFile={file}
          onImported={() => {
            setExtractedEvents(null)
            setFile(null)
            setPreview(null)
          }}
          onDiscard={() => setExtractedEvents(null)}
        />
      )}
    </div>
  )
}
