"use client"

import { useState, useEffect } from "react"
import { Trash2, Check, X } from "lucide-react"
import { pathToPoints, smoothedPath } from "@/lib/shapeUtils"

const LS_KEY = "plandoom_shape_presets"

type UserPreset = { id: string; name: string; path: string }

function ShapeThumbnail({ path }: { path: string }) {
  const pts = pathToPoints(path)
  const d = pts.length >= 3 ? smoothedPath(pts, 0) : ""
  if (!d) return <div className="w-9 h-9 rounded bg-smoke-700 shrink-0" />
  return (
    <svg
      width={36}
      height={36}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="shrink-0 rounded"
      style={{ display: "block" }}
    >
      <path
        d={d}
        fill="rgba(22,45,94,0.9)"
        stroke="#c9a84c"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function ShapePresetsSection() {
  const [presets, setPresets] = useState<UserPreset[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setPresets(JSON.parse(raw) as UserPreset[])
    } catch { /* ignore */ }
  }, [])

  function persist(updated: UserPreset[]) {
    setPresets(updated)
    localStorage.setItem(LS_KEY, JSON.stringify(updated))
  }

  function handleDelete(id: string) {
    persist(presets.filter((p) => p.id !== id))
  }

  function startEdit(p: UserPreset) {
    setEditingId(p.id)
    setEditName(p.name)
  }

  function confirmEdit(id: string) {
    const name = editName.trim()
    if (!name) return
    persist(presets.map((p) => (p.id === id ? { ...p, name } : p)))
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-smoke-100">Shape Presets</h2>
        <p className="text-[10px] text-smoke-500 mt-0.5">
          Saved from the polygon editor in the Event Form
        </p>
      </div>

      {presets.length === 0 ? (
        <p className="text-xs text-smoke-500 py-4 text-center">
          No shapes saved yet. Use the polygon editor inside the Event Form to create and save shapes.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-smoke-700 bg-smoke-900/40 hover:border-smoke-600 transition-colors"
            >
              <ShapeThumbnail path={p.path} />

              {editingId === p.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit(p.id)
                      if (e.key === "Escape") cancelEdit()
                    }}
                    maxLength={100}
                    className="flex-1 bg-smoke-800 border border-smoke-600 rounded px-2 py-1 text-xs text-smoke-100 focus:outline-none focus:border-doom-gold/50"
                  />
                  <button
                    onClick={() => confirmEdit(p.id)}
                    className="p-1 text-smoke-400 hover:text-doom-gold transition-colors"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 text-smoke-400 hover:text-smoke-200 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => startEdit(p)}
                    className="flex-1 text-left text-xs text-smoke-200 hover:text-smoke-100 transition-colors truncate"
                    title="Click to rename"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-smoke-500 hover:text-doom-ember transition-colors rounded hover:bg-smoke-800"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
