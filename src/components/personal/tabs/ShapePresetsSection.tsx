"use client"

import { useState, useEffect } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { pathToPoints, smoothedPath } from "@/lib/shapeUtils"
import PolygonEditor from "@/components/events/EventForm/tabs/PolygonEditor"

const LS_KEY = "plandoom_shape_presets"

type UserPreset = {
  id: string
  name: string
  path: string
  smoothing?: number
  fillColor?: string
  frameColor?: string
}

function loadPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as UserPreset[]) : []
  } catch {
    return []
  }
}

function savePresets(presets: UserPreset[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(presets))
}

// ── ShapeThumbnail ────────────────────────────────────────────────────────────

function ShapeThumbnail({
  path,
  smoothing = 0,
  fillColor = "rgba(22,45,94,0.9)",
  frameColor = "#c9a84c",
  size = 36,
}: {
  path: string
  smoothing?: number
  fillColor?: string
  frameColor?: string
  size?: number
}) {
  const pts = pathToPoints(path)
  const d = pts.length >= 3 ? smoothedPath(pts, smoothing) : ""
  if (!d) return <div className="rounded bg-smoke-700 shrink-0" style={{ width: size, height: size }} />
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="shrink-0 rounded"
      style={{ display: "block" }}
    >
      <path
        d={d}
        fill={fillColor}
        stroke={frameColor}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ── ShapePresetForm ───────────────────────────────────────────────────────────

type FormState = {
  name: string
  path: string | null
  smoothing: number
  textPosition: { x: number; y: number } | null
  widthPercent: number
  leftOffset: number
  fillColor: string
  frameColor: string
}

function makeInitialForm(preset?: UserPreset): FormState {
  return {
    name: preset?.name ?? "",
    path: preset?.path ?? null,
    smoothing: preset?.smoothing ?? 0,
    textPosition: null,
    widthPercent: 100,
    leftOffset: 0,
    fillColor: preset?.fillColor ?? "rgba(22,45,94,0.9)",
    frameColor: preset?.frameColor ?? "#c9a84c",
  }
}

function ShapePresetForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: UserPreset
  onSave: (data: Omit<UserPreset, "id">) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(() => makeInitialForm(initial))

  function patch(updates: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  function handleSave() {
    if (!form.name.trim() || !form.path) return
    onSave({
      name: form.name.trim(),
      path: form.path,
      smoothing: form.smoothing,
      fillColor: form.fillColor,
      frameColor: form.frameColor,
    })
  }

  const canSave = !!form.name.trim() && !!form.path

  return (
    <div className="flex flex-col gap-4 p-3 border border-smoke-700 rounded-lg bg-navy-900/60">
      {/* Preview + name row */}
      <div className="flex items-center gap-3">
        <ShapeThumbnail
          path={form.path ?? ""}
          smoothing={form.smoothing}
          fillColor={form.fillColor}
          frameColor={form.frameColor}
          size={56}
        />
        <div className="flex-1">
          <label className="text-[10px] text-smoke-500 uppercase tracking-wider">Name</label>
          <input
            autoFocus
            type="text"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Shape name…"
            maxLength={100}
            className="mt-1 w-full bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 placeholder:text-smoke-600 focus:outline-none focus:border-doom-gold/50"
          />
        </div>
      </div>

      {/* Fill + Frame pickers */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-smoke-500 uppercase tracking-wider">Fill</label>
          <div className="flex items-center gap-1.5 bg-smoke-800 border border-smoke-600 rounded px-1.5 py-1">
            <input
              type="color"
              value={form.fillColor.startsWith("rgba") ? "#162d5e" : form.fillColor}
              onChange={(e) => patch({ fillColor: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={form.fillColor}
              onChange={(e) => patch({ fillColor: e.target.value })}
              maxLength={30}
              className="w-28 bg-transparent text-[10px] text-smoke-300 focus:outline-none font-mono"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-smoke-500 uppercase tracking-wider">Frame</label>
          <div className="flex items-center gap-1.5 bg-smoke-800 border border-smoke-600 rounded px-1.5 py-1">
            <input
              type="color"
              value={form.frameColor}
              onChange={(e) => patch({ frameColor: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={form.frameColor}
              onChange={(e) => patch({ frameColor: e.target.value })}
              maxLength={30}
              className="w-20 bg-transparent text-[10px] text-smoke-300 focus:outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Polygon editor */}
      <div className="border border-smoke-700 rounded-lg p-2 bg-navy-950/40">
        <PolygonEditor
          shapePath={form.path}
          onChange={(p) => patch({ path: p })}
          canvasHeight={200}
          smoothing={form.smoothing}
          onSmoothing={(v) => patch({ smoothing: v })}
          textPosition={form.textPosition}
          onTextPosition={(tp) => patch({ textPosition: tp })}
          widthPercent={form.widthPercent}
          onWidthPercent={(v) => patch({ widthPercent: v })}
          leftOffset={form.leftOffset}
          onLeftOffset={(v) => patch({ leftOffset: v })}
          hidePresets
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-smoke-400 hover:text-smoke-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 text-smoke-100 rounded disabled:opacity-50 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  )
}

// ── PresetRow ─────────────────────────────────────────────────────────────────

function PresetRow({
  preset,
  isEditing,
  onEdit,
  onDelete,
}: {
  preset: UserPreset
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDelete() {
    if (confirmDelete) {
      onDelete()
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        isEditing
          ? "border-doom-gold/40 bg-navy-800/40"
          : "border-smoke-700 bg-smoke-900/30 hover:border-smoke-600"
      }`}
    >
      <ShapeThumbnail
        path={preset.path}
        smoothing={preset.smoothing}
        fillColor={preset.fillColor}
        frameColor={preset.frameColor}
      />
      <span className="flex-1 text-xs text-smoke-200 truncate" title={preset.name}>
        {preset.name}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-[10px] text-doom-ember mr-1">Delete?</span>
            <button
              onClick={onDelete}
              className="px-2 py-1 text-[10px] bg-doom-ember/20 text-doom-ember rounded hover:bg-doom-ember/30 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 text-[10px] text-smoke-400 hover:text-smoke-200 transition-colors"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="p-1.5 text-smoke-500 hover:text-smoke-200 rounded hover:bg-smoke-800 transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 text-smoke-500 hover:text-doom-ember rounded hover:bg-smoke-800 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── ShapePresetsSection ───────────────────────────────────────────────────────

export default function ShapePresetsSection() {
  const [presets, setPresets] = useState<UserPreset[]>([])
  const [editingId, setEditingId] = useState<string | "new" | null>(null)

  useEffect(() => {
    setPresets(loadPresets())
  }, [])

  function persist(updated: UserPreset[]) {
    setPresets(updated)
    savePresets(updated)
  }

  function handleSave(id: string | "new", data: Omit<UserPreset, "id">) {
    if (id === "new") {
      persist([...presets, { id: Date.now().toString(), ...data }])
    } else {
      persist(presets.map((p) => (p.id === id ? { ...p, ...data } : p)))
    }
    setEditingId(null)
  }

  function handleDelete(id: string) {
    persist(presets.filter((p) => p.id !== id))
    if (editingId === id) setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-smoke-100">Shape Presets</h2>
        <p className="text-[10px] text-smoke-500 mt-0.5">Custom polygon shapes for event blocks</p>
      </div>

      {presets.length === 0 && editingId !== "new" && (
        <p className="text-xs text-smoke-500 py-4 text-center">No shapes saved yet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {presets.map((p) => (
          <div key={p.id} className="flex flex-col gap-1.5">
            <PresetRow
              preset={p}
              isEditing={editingId === p.id}
              onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
              onDelete={() => handleDelete(p.id)}
            />
            {editingId === p.id && (
              <ShapePresetForm
                key={p.id}
                initial={p}
                onSave={(data) => handleSave(p.id, data)}
                onCancel={() => setEditingId(null)}
              />
            )}
          </div>
        ))}

        {editingId === "new" && (
          <ShapePresetForm
            key="new"
            onSave={(data) => handleSave("new", data)}
            onCancel={() => setEditingId(null)}
          />
        )}
      </div>

      {editingId !== "new" && (
        <button
          onClick={() => setEditingId("new")}
          className="flex items-center gap-1.5 self-start px-3 py-1.5 text-xs text-smoke-400 hover:text-smoke-200 border border-dashed border-smoke-700 hover:border-smoke-500 rounded transition-colors mt-1"
        >
          + New Shape Preset
        </button>
      )}
    </div>
  )
}
