"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ApiFolder } from "@/types"

interface ChipFormProps {
  onSave: () => Promise<void>
  onClose: () => void
  prefillTitle?: string
  prefillDescription?: string
}

type ChipDraft = {
  title: string
  description: string
  duration: string
  location: string
  locationUrl: string
  folderId: string
  count: number
  mentalEnergy: number
  physicalEnergy: number
  difficulty: number
  optimalityTarget: number
}

function input(extra?: string) {
  return `bg-smoke-800 border border-smoke-700 text-smoke-100 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-smoke-500 ${extra ?? ""}`
}

function Slider({ label, icon, value, onChange }: { label: string; icon: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-smoke-400">{icon} {label}</span>
        <span className="text-[10px] text-doom-gold font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-doom-gold h-1"
      />
    </div>
  )
}

export default function ChipForm({ onSave, onClose, prefillTitle, prefillDescription }: ChipFormProps) {
  const [draft, setDraft] = useState<ChipDraft>({
    title: prefillTitle ?? "",
    description: prefillDescription ?? "",
    duration: "",
    location: "",
    locationUrl: "",
    folderId: "",
    count: 1,
    mentalEnergy: 50,
    physicalEnergy: 50,
    difficulty: 50,
    optimalityTarget: 80,
  })
  const [prodoOpen, setProDoOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      return res.json() as Promise<ApiFolder[]>
    },
  })

  function patch(partial: Partial<ChipDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  async function save() {
    if (!draft.title.trim()) return
    setSaving(true)
    try {
      const body = {
        title: draft.title.trim(),
        description: draft.description || undefined,
        area: "pouch" as const,
        duration: draft.duration ? Number(draft.duration) : undefined,
        location: draft.location || undefined,
        locationUrl: draft.locationUrl || undefined,
        folderId: draft.folderId || undefined,
        mentalEnergy: draft.mentalEnergy,
        physicalEnergy: draft.physicalEnergy,
        difficulty: draft.difficulty,
        optimalityTarget: draft.optimalityTarget,
      }

      // Crea N chip identici — N è solo logica UI
      const count = Math.max(1, Math.min(20, draft.count))
      await Promise.all(
        Array.from({ length: count }, () =>
          fetch("/api/chips", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )
      )

      await onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-smoke-700 shrink-0">
          <h2 className="text-sm font-semibold text-smoke-200">New Chip</h2>
          <button onClick={onClose} className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Title */}
          <div>
            <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">Title</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Chip name"
              className={input("w-full")}
              autoFocus
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">⏱ Duration (min)</label>
            <input
              type="number"
              min={1}
              value={draft.duration}
              onChange={(e) => patch({ duration: e.target.value })}
              placeholder="e.g. 45"
              className={input("w-32")}
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-2">
            <label className="block text-[10px] text-smoke-500 uppercase tracking-wider">📍 Location</label>
            <input
              type="text"
              value={draft.location}
              onChange={(e) => patch({ location: e.target.value })}
              placeholder="Place or address"
              className={input("w-full")}
            />
            {draft.location && (
              <input
                type="url"
                value={draft.locationUrl}
                onChange={(e) => patch({ locationUrl: e.target.value })}
                placeholder="Google Maps link (optional)"
                className={input("w-full text-xs")}
              />
            )}
          </div>

          {/* Folder */}
          <div>
            <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">📁 Folder</label>
            <select
              value={draft.folderId}
              onChange={(e) => patch({ folderId: e.target.value })}
              className={input("w-full")}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Number of chips */}
          <div>
            <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">Number of chips</label>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.count}
              onChange={(e) => patch({ count: Math.max(1, Math.min(20, Number(e.target.value))) })}
              className={input("w-24")}
            />
            {draft.count > 1 && (
              <p className="text-[10px] text-smoke-500 mt-1">{draft.count} identical chips will be created</p>
            )}
          </div>

          {/* Prodo section */}
          <div className="border-t border-smoke-700 pt-4">
            <button
              type="button"
              onClick={() => setProDoOpen((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors uppercase tracking-wider"
            >
              <span>{prodoOpen ? "▾" : "▸"}</span>
              Prodo
            </button>

            {prodoOpen && (
              <div className="flex flex-col gap-3 mt-3">
                <Slider label="Mental Energy" icon="🧠" value={draft.mentalEnergy} onChange={(v) => patch({ mentalEnergy: v })} />
                <Slider label="Physical Energy" icon="💪" value={draft.physicalEnergy} onChange={(v) => patch({ physicalEnergy: v })} />
                <Slider label="Difficulty" icon="⚡" value={draft.difficulty} onChange={(v) => patch({ difficulty: v })} />

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-smoke-400">🎯 Optimality target</span>
                    <span className="text-[10px] text-doom-gold font-mono">{draft.optimalityTarget}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={draft.optimalityTarget}
                    onChange={(e) => patch({ optimalityTarget: Number(e.target.value) })}
                    className="w-full accent-doom-gold h-1"
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-smoke-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-smoke-400 hover:text-smoke-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !draft.title.trim()}
            className="px-4 py-1.5 text-xs font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
          >
            {saving ? "Creating…" : draft.count > 1 ? `Create ${draft.count} chips` : "Create chip"}
          </button>
        </div>

      </div>
    </div>
  )
}
