"use client"

import { useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ApiChip, ApiFolder, ChipArea as ChipAreaType, VisualStyle } from "@/types"
import { PX_PER_HOUR } from "@/hooks/useGrid"
import StyleTab from "@/components/events/EventForm/tabs/StyleTab"

type ActiveTab = "main" | "style" | "prodo"

export const DEFAULT_CHIP_STYLE: VisualStyle = {
  shape: "rounded",
  frameColor: "transparent",
  frameWidth: 1,
  sideColor: "#c9a84c",
  sideWidth: 2,
  fillColor: "#162d5e",
  fillOpacity: 100,
  textColor: "#d1d5db",
  fontFamily: "inherit",
  hasCheckbox: false,
  isChecked: false,
  eventType: "default",
  shapePath: null,
  shapeSmoothing: 0,
  textPosition: null,
  widthPercent: 100,
  leftOffset: 0,
}

function parseVisualStyle(raw: unknown): VisualStyle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_CHIP_STYLE
  const r = raw as Record<string, unknown>
  const tp = r.textPosition as { x: number; y: number } | null | undefined
  return {
    shape: (["rectangle", "rounded", "pill"].includes(r.shape as string)
      ? r.shape : DEFAULT_CHIP_STYLE.shape) as VisualStyle["shape"],
    frameColor: typeof r.frameColor === "string" ? r.frameColor : DEFAULT_CHIP_STYLE.frameColor,
    frameWidth: typeof r.frameWidth === "number" ? r.frameWidth : DEFAULT_CHIP_STYLE.frameWidth,
    sideColor: typeof r.sideColor === "string" ? r.sideColor : DEFAULT_CHIP_STYLE.sideColor,
    sideWidth: typeof r.sideWidth === "number" ? r.sideWidth : DEFAULT_CHIP_STYLE.sideWidth,
    fillColor: typeof r.fillColor === "string" ? r.fillColor : DEFAULT_CHIP_STYLE.fillColor,
    fillOpacity: typeof r.fillOpacity === "number" ? r.fillOpacity : 100,
    textColor: typeof r.textColor === "string" ? r.textColor : DEFAULT_CHIP_STYLE.textColor,
    fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : DEFAULT_CHIP_STYLE.fontFamily,
    hasCheckbox: typeof r.hasCheckbox === "boolean" ? r.hasCheckbox : DEFAULT_CHIP_STYLE.hasCheckbox,
    isChecked: typeof r.isChecked === "boolean" ? r.isChecked : DEFAULT_CHIP_STYLE.isChecked,
    eventType: typeof r.eventType === "string" ? r.eventType : DEFAULT_CHIP_STYLE.eventType,
    shapePath: typeof r.shapePath === "string" ? r.shapePath : null,
    shapeSmoothing: typeof r.shapeSmoothing === "number" ? r.shapeSmoothing : 0,
    textPosition: tp && typeof tp.x === "number" && typeof tp.y === "number" ? tp : null,
    widthPercent: typeof r.widthPercent === "number" ? r.widthPercent : 100,
    leftOffset: typeof r.leftOffset === "number" ? r.leftOffset : 0,
  }
}

interface ChipFormProps {
  chipToEdit?: ApiChip        // when set: edit mode
  area?: ChipAreaType
  dayTarget?: string
  weekNumber?: number
  year?: number
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
  visualStyle: VisualStyle
}

function cls(extra?: string) {
  return `bg-smoke-800 border border-smoke-700 text-smoke-100 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-smoke-500 ${extra ?? ""}`
}

function Slider({ label, icon, value, onChange }: {
  label: string
  icon: string
  value: number
  onChange: (v: number) => void
}) {
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

function initDraft(chip?: ApiChip, prefillTitle?: string, prefillDescription?: string): ChipDraft {
  if (chip) {
    return {
      title: chip.title,
      description: chip.description ?? "",
      duration: chip.duration ? String(chip.duration) : "",
      location: chip.location ?? "",
      locationUrl: chip.locationUrl ?? "",
      folderId: chip.folderId ?? "",
      count: 1,
      mentalEnergy: chip.mentalEnergy ?? 50,
      physicalEnergy: chip.physicalEnergy ?? 50,
      difficulty: chip.difficulty ?? 50,
      optimalityTarget: chip.optimalityTarget ?? 80,
      visualStyle: parseVisualStyle(chip.visualStyle),
    }
  }
  return {
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
    visualStyle: DEFAULT_CHIP_STYLE,
  }
}

export default function ChipForm({
  chipToEdit,
  area = "pouch",
  dayTarget,
  weekNumber,
  year,
  onSave,
  onClose,
  prefillTitle,
  prefillDescription,
}: ChipFormProps) {
  const isEditing = !!chipToEdit
  const [activeTab, setActiveTab] = useState<ActiveTab>("main")
  const [draft, setDraft] = useState<ChipDraft>(() => initDraft(chipToEdit, prefillTitle, prefillDescription))
  const [saving, setSaving] = useState(false)
  const [folderStylePending, setFolderStylePending] = useState<VisualStyle | null>(null)

  // Track the last folderId to distinguish first selection vs folder change
  const prevFolderIdRef = useRef<string>(chipToEdit?.folderId ?? "")

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      return res.json() as Promise<ApiFolder[]>
    },
  })

  function applyVS(vs: VisualStyle) {
    setDraft((prev) => ({ ...prev, visualStyle: vs }))
  }

  function handleFolderChange(newId: string) {
    const prevId = prevFolderIdRef.current
    prevFolderIdRef.current = newId
    patch({ folderId: newId })

    if (!newId) return  // clearing → keep style

    const folder = folders.find((f) => f.id === newId)
    if (!folder?.visualStyle) return

    const newStyle = parseVisualStyle(folder.visualStyle)

    if (!prevId) {
      // First selection: auto-apply
      applyVS(newStyle)
    } else {
      // Changing from one folder to another: ask
      setFolderStylePending(newStyle)
    }
  }

  function patch(partial: Partial<ChipDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function patchStyle(partial: Partial<VisualStyle>) {
    setDraft((prev) => ({ ...prev, visualStyle: { ...prev.visualStyle, ...partial } }))
  }

  const durationPx = draft.duration
    ? Number(draft.duration) * (PX_PER_HOUR / 60)
    : PX_PER_HOUR

  async function save() {
    if (!draft.title.trim()) return
    setSaving(true)
    try {
      const body = {
        title: draft.title.trim(),
        description: draft.description || undefined,
        duration: draft.duration ? Number(draft.duration) : undefined,
        location: draft.location || undefined,
        locationUrl: draft.locationUrl || undefined,
        folderId: draft.folderId || undefined,
        mentalEnergy: draft.mentalEnergy,
        physicalEnergy: draft.physicalEnergy,
        difficulty: draft.difficulty,
        optimalityTarget: draft.optimalityTarget,
        visualStyle: draft.visualStyle,
      }

      if (isEditing) {
        // Edit mode: PATCH existing chip
        await fetch(`/api/chips/${chipToEdit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        // Create mode: POST N chips with area context
        const createBody = {
          ...body,
          area,
          dayTarget,
          weekNumber,
          year,
        }
        const count = Math.max(1, Math.min(20, draft.count))
        await Promise.all(
          Array.from({ length: count }, () =>
            fetch("/api/chips", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(createBody),
            })
          )
        )
      }

      await onSave()
    } finally {
      setSaving(false)
    }
  }

  const TABS: { id: ActiveTab; label: string }[] = [
    { id: "main", label: "Main" },
    { id: "style", label: "Style" },
    { id: "prodo", label: "Prodo" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-smoke-700 shrink-0">
          <h2 className="text-sm font-semibold text-smoke-200">
            {isEditing ? "Edit Chip" : "New Chip"}
          </h2>
          <button
            onClick={onClose}
            className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-smoke-700 shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-doom-gold border-b-2 border-doom-gold -mb-px"
                  : "text-smoke-400 hover:text-smoke-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Main tab */}
          {activeTab === "main" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">Title</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Chip name"
                  className={cls("w-full")}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">⏱ Duration (min)</label>
                <input
                  type="number"
                  min={1}
                  value={draft.duration}
                  onChange={(e) => patch({ duration: e.target.value })}
                  placeholder="e.g. 45"
                  className={cls("w-32")}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-[10px] text-smoke-500 uppercase tracking-wider">📍 Location</label>
                <input
                  type="text"
                  value={draft.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  placeholder="Place or address"
                  className={cls("w-full")}
                />
                {draft.location && (
                  <input
                    type="url"
                    value={draft.locationUrl}
                    onChange={(e) => patch({ locationUrl: e.target.value })}
                    placeholder="Google Maps link (optional)"
                    className={cls("w-full text-xs")}
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">📁 Folder</label>
                <select
                  value={draft.folderId}
                  onChange={(e) => handleFolderChange(e.target.value)}
                  className={cls("w-full")}
                >
                  <option value="">No folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Folder style confirmation */}
              {folderStylePending && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-doom-gold/10 border border-doom-gold/30">
                  <span className="text-xs text-doom-gold flex-1">Apply new folder style?</span>
                  <button
                    type="button"
                    onClick={() => { applyVS(folderStylePending); setFolderStylePending(null) }}
                    className="text-xs text-doom-gold font-medium hover:text-doom-gold/70 transition-colors"
                  >
                    Apply
                  </button>
                  <span className="text-smoke-600 text-xs">·</span>
                  <button
                    type="button"
                    onClick={() => setFolderStylePending(null)}
                    className="text-xs text-smoke-400 hover:text-smoke-200 transition-colors"
                  >
                    Keep
                  </button>
                </div>
              )}

              {/* "Number of chips" only in create mode */}
              {!isEditing && (
                <div>
                  <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">Number of chips</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={draft.count}
                    onChange={(e) => patch({ count: Math.max(1, Math.min(20, Number(e.target.value))) })}
                    className={cls("w-24")}
                  />
                  {draft.count > 1 && (
                    <p className="text-[10px] text-smoke-500 mt-1">{draft.count} identical chips will be created</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Style tab */}
          {activeTab === "style" && (
            <StyleTab
              vs={draft.visualStyle}
              onChange={patchStyle}
              durationPx={durationPx}
            />
          )}

          {/* Prodo tab */}
          {activeTab === "prodo" && (
            <div className="flex flex-col gap-3 pt-1">
              <Slider label="Mental Energy" icon="🧠" value={draft.mentalEnergy} onChange={(v) => patch({ mentalEnergy: v })} />
              <Slider label="Physical Energy" icon="💪" value={draft.physicalEnergy} onChange={(v) => patch({ physicalEnergy: v })} />
              <Slider label="Difficulty" icon="⚡" value={draft.difficulty} onChange={(v) => patch({ difficulty: v })} />

              <div className="flex flex-col gap-1 mt-2">
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
            {saving
              ? (isEditing ? "Saving…" : "Creating…")
              : isEditing
                ? "Save chip"
                : draft.count > 1
                  ? `Create ${draft.count} chips`
                  : "Create chip"
            }
          </button>
        </div>

      </div>
    </div>
  )
}
