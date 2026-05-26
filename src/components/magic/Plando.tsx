"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

type MoveEvent = {
  type: "move_event"
  eventId: string
  eventTitle: string
  currentStart: string
  currentEnd: string
  proposedStart: string
  proposedEnd: string
  reason: string
}

type ScheduleChip = {
  type: "schedule_chip"
  chipId: string
  chipTitle: string
  proposedStart: string
  proposedEnd: string
  reason: string
}

type Suggestion = MoveEvent | ScheduleChip

type PlandoResult = {
  analysis: string
  suggestions: Suggestion[]
}

interface PlandoProps {
  weekStart: Date
  weekEnd: Date
  onClose: () => void
}

function fmtRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const day = s.toLocaleString("en-GB", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
  const t1 = s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
  const t2 = e.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
  return `${day} ${t1} – ${t2}`
}

export default function Plando({ weekStart, weekEnd, onClose }: PlandoProps) {
  const queryClient = useQueryClient()
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<PlandoResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function analyze() {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch("/api/plando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
        }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as PlandoResult
      setResult(data)
      setSelected(new Set(data.suggestions.map((_, i) => i)))
    } catch {
      setError("Plando failed to analyze your schedule. Try again.")
    } finally {
      setAnalyzing(false)
    }
  }

  async function apply() {
    if (!result) return
    setApplying(true)
    try {
      const chosen = result.suggestions.filter((_, i) => selected.has(i))
      await Promise.all(
        chosen.map((s) => {
          if (s.type === "move_event") {
            return fetch(`/api/events/${s.eventId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ startTime: s.proposedStart, endTime: s.proposedEnd }),
            })
          }
          return fetch(`/api/chips/${s.chipId}/convert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startTime: s.proposedStart, endTime: s.proposedEnd }),
          })
        })
      )
      await queryClient.invalidateQueries({ queryKey: ["events"] })
      await queryClient.invalidateQueries({ queryKey: ["chips"] })
      onClose()
    } finally {
      setApplying(false)
    }
  }

  function toggleAll(on: boolean) {
    setSelected(on ? new Set(result?.suggestions.map((_, i) => i)) : new Set())
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const selectedCount = selected.size

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-smoke-700 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-smoke-100 uppercase tracking-widest">Plando</h2>
            <p className="text-[10px] text-smoke-500 mt-0.5">AI schedule optimizer — reorganize your week</p>
          </div>
          <button onClick={onClose} className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {!result && !analyzing && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <span className="text-5xl" style={{ color: "#4a2d6b", filter: "drop-shadow(0 0 8px #4a2d6b88)" }}>⚜</span>
              <p className="text-xs text-smoke-400 text-center max-w-xs leading-relaxed">
                Plando will analyze your flexible events and unscheduled chips, identify open slots, and suggest concrete moves for a better week.
              </p>
            </div>
          )}

          {analyzing && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <span className="text-5xl animate-pulse" style={{ color: "#4a2d6b" }}>⚜</span>
              <p className="text-xs text-smoke-400">The Golem is consulting the stars…</p>
            </div>
          )}

          {error && (
            <p className="text-xs text-doom-ember bg-doom-ember/10 border border-doom-ember/30 rounded px-3 py-2">{error}</p>
          )}

          {result && (
            <>
              {/* Analysis summary */}
              <div className="bg-doom-rune/10 border border-doom-rune/40 rounded-lg px-4 py-3">
                <p className="text-xs text-smoke-300 leading-relaxed">{result.analysis}</p>
              </div>

              {result.suggestions.length === 0 ? (
                <p className="text-xs text-smoke-500 italic text-center py-4">
                  No changes needed — your week is well organized.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-smoke-300 uppercase tracking-wider">
                      {result.suggestions.length} suggestion{result.suggestions.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => toggleAll(true)} className="text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors">All</button>
                      <button onClick={() => toggleAll(false)} className="text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors">None</button>
                    </div>
                  </div>

                  {result.suggestions.map((s, i) => (
                    <div
                      key={i}
                      onClick={() => toggle(i)}
                      className={`rounded-lg border px-3 py-2.5 cursor-pointer transition-all ${
                        selected.has(i)
                          ? "border-doom-rune/60 bg-doom-rune/10"
                          : "border-smoke-700/50 bg-smoke-800/20 opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggle(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-doom-rune mt-0.5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: "#4a2d6b44", color: "#9b7ec8" }}>
                              {s.type === "move_event" ? "↕ Move" : "+ Schedule"}
                            </span>
                            <span className="text-xs font-medium text-smoke-100 truncate">
                              {s.type === "move_event" ? s.eventTitle : s.chipTitle}
                            </span>
                          </div>

                          {s.type === "move_event" && (
                            <p className="text-[10px] text-smoke-500 mb-0.5 line-through">
                              {fmtRange(s.currentStart, s.currentEnd)}
                            </p>
                          )}
                          <p className="text-[10px] text-doom-gold font-medium">
                            → {fmtRange(s.proposedStart, s.proposedEnd)}
                          </p>
                          <p className="text-[10px] text-smoke-400 mt-1.5 leading-relaxed">{s.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-smoke-700 shrink-0 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm text-smoke-400 hover:text-smoke-200 transition-colors">
            Cancel
          </button>
          {!result ? (
            <button
              onClick={analyze}
              disabled={analyzing}
              className="px-5 py-2 text-sm font-medium rounded-lg disabled:opacity-40 transition-colors flex items-center gap-2"
              style={{ backgroundColor: "#4a2d6b", color: "#d1d5db" }}
            >
              {analyzing ? (
                <><span className="inline-block w-3 h-3 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />Analyzing…</>
              ) : "Optimize my week"}
            </button>
          ) : (
            <button
              onClick={apply}
              disabled={selectedCount === 0 || applying}
              className="px-5 py-2 text-sm font-medium rounded-lg disabled:opacity-40 transition-colors flex items-center gap-2"
              style={{ backgroundColor: "#4a2d6b", color: "#d1d5db" }}
            >
              {applying ? (
                <><span className="inline-block w-3 h-3 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />Applying…</>
              ) : `Apply ${selectedCount} change${selectedCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
