"use client"

import { useState } from "react"
import type React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2, Plus, X } from "lucide-react"
import type { ApiPalette, ApiFolder } from "@/types"

const MAX_COLORS = 12

// ── PaletteCard ───────────────────────────────────────────────────────────────

function PaletteCard({
  palette,
  linkedFolder,
  onEdit,
  onDelete,
}: {
  palette: ApiPalette
  linkedFolder: ApiFolder | undefined
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-smoke-700 bg-smoke-900/40 hover:border-smoke-600 transition-colors">
      <div className="flex gap-0.5 flex-shrink-0 flex-wrap max-w-[120px]">
        {palette.colors.slice(0, 8).map((c, i) => (
          <div key={i} className="w-4 h-4 rounded-sm border border-smoke-800" style={{ background: c }} />
        ))}
        {palette.colors.length > 8 && (
          <div className="w-4 h-4 rounded-sm bg-smoke-800 flex items-center justify-center text-[7px] text-smoke-400">
            +{palette.colors.length - 8}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-smoke-200 truncate">{palette.name}</div>
        {linkedFolder && (
          <div className="text-[10px] text-smoke-500 truncate mt-0.5">📁 {linkedFolder.name}</div>
        )}
      </div>

      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 text-smoke-500 hover:text-smoke-200 transition-colors rounded hover:bg-smoke-800"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-smoke-500 hover:text-doom-ember transition-colors rounded hover:bg-smoke-800"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── PaletteForm ───────────────────────────────────────────────────────────────

type PaletteFormData = {
  name: string
  colors: string[]
  linkedFolderId: string | null
}

function PaletteForm({
  initial,
  folders,
  onSave,
  onCancel,
}: {
  initial: PaletteFormData
  folders: ApiFolder[]
  onSave: (data: PaletteFormData) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [colors, setColors] = useState<string[]>(
    initial.colors.length > 0 ? initial.colors : ["#c9a84c"]
  )
  const [linkedFolderId, setLinkedFolderId] = useState<string | null>(initial.linkedFolderId)
  const [saving, setSaving] = useState(false)

  function addColor() {
    if (colors.length >= MAX_COLORS) return
    setColors([...colors, "#808080"])
  }

  function removeColor(i: number) {
    if (colors.length <= 1) return
    setColors(colors.filter((_, idx) => idx !== i))
  }

  function updateColor(i: number, value: string) {
    const next = [...colors]
    next[i] = value
    setColors(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), colors, linkedFolderId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-4 border border-smoke-700 rounded-lg bg-navy-900/60"
    >
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-smoke-500 uppercase tracking-wider">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My palette"
          maxLength={100}
          className="bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 placeholder:text-smoke-600 focus:outline-none focus:border-doom-gold/50"
        />
      </div>

      {/* Colors */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-smoke-500 uppercase tracking-wider">
          Colors{" "}
          <span className="text-smoke-600 normal-case">
            ({colors.length}/{MAX_COLORS})
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {colors.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-1 bg-smoke-800 border border-smoke-600 rounded px-1.5 py-1"
            >
              <input
                type="color"
                value={c}
                onChange={(e) => updateColor(i, e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                style={{ WebkitAppearance: "none" } as React.CSSProperties}
              />
              <input
                type="text"
                value={c}
                onChange={(e) => updateColor(i, e.target.value)}
                maxLength={7}
                className="w-[4.5rem] bg-transparent text-[10px] text-smoke-300 focus:outline-none font-mono"
              />
              {colors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeColor(i)}
                  className="text-smoke-600 hover:text-doom-ember transition-colors"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          {colors.length < MAX_COLORS && (
            <button
              type="button"
              onClick={addColor}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-smoke-500 hover:text-smoke-300 border border-dashed border-smoke-700 rounded transition-colors"
            >
              <Plus size={10} />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Folder link */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-smoke-500 uppercase tracking-wider">Link to folder</label>
        <select
          value={linkedFolderId ?? ""}
          onChange={(e) => setLinkedFolderId(e.target.value || null)}
          className="bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 focus:outline-none focus:border-doom-gold/50"
        >
          <option value="">None</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
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
          type="submit"
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 text-smoke-100 rounded disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  )
}

// ── ColorPresetsTab ───────────────────────────────────────────────────────────

export default function ColorPresetsTab() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<"idle" | "creating" | "editing">("idle")
  const [editTarget, setEditTarget] = useState<ApiPalette | null>(null)

  const { data: palettes = [], isLoading } = useQuery<ApiPalette[]>({
    queryKey: ["palettes"],
    queryFn: async () => {
      const res = await fetch("/api/palettes")
      if (!res.ok) throw new Error("Failed to load palettes")
      return res.json() as Promise<ApiPalette[]>
    },
  })

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      if (!res.ok) throw new Error("Failed to load folders")
      return res.json() as Promise<ApiFolder[]>
    },
  })

  function linkedFolder(paletteId: string): ApiFolder | undefined {
    return folders.find((f) => {
      const vs = f.visualStyle as Record<string, unknown> | null
      return vs?.paletteId === paletteId
    })
  }

  async function patchFolderPaletteId(folderId: string, paletteId: string | null) {
    await fetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paletteId }),
    })
  }

  async function handleSave(data: PaletteFormData) {
    if (mode === "creating") {
      const res = await fetch("/api/palettes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, type: "personal", colors: data.colors }),
      })
      if (res.ok && data.linkedFolderId) {
        const newPalette = (await res.json()) as ApiPalette
        await patchFolderPaletteId(data.linkedFolderId, newPalette.id)
      }
    } else if (mode === "editing" && editTarget) {
      await fetch(`/api/palettes/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, colors: data.colors }),
      })

      const oldFolderId = linkedFolder(editTarget.id)?.id ?? null
      if (oldFolderId !== data.linkedFolderId) {
        if (oldFolderId) await patchFolderPaletteId(oldFolderId, null)
        if (data.linkedFolderId) await patchFolderPaletteId(data.linkedFolderId, editTarget.id)
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["palettes"] })
    await queryClient.invalidateQueries({ queryKey: ["folders"] })
    setMode("idle")
    setEditTarget(null)
  }

  async function handleDelete(palette: ApiPalette) {
    const lf = linkedFolder(palette.id)
    if (lf) await patchFolderPaletteId(lf.id, null)
    await fetch(`/api/palettes/${palette.id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["palettes"] })
    await queryClient.invalidateQueries({ queryKey: ["folders"] })
  }

  function startEdit(palette: ApiPalette) {
    setEditTarget(palette)
    setMode("editing")
  }

  function cancel() {
    setMode("idle")
    setEditTarget(null)
  }

  const formInitial: PaletteFormData =
    mode === "editing" && editTarget
      ? {
          name: editTarget.name,
          colors: editTarget.colors,
          linkedFolderId: linkedFolder(editTarget.id)?.id ?? null,
        }
      : { name: "", colors: ["#c9a84c"], linkedFolderId: null }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-smoke-100">Color Palettes</h2>
          <p className="text-[10px] text-smoke-500 mt-0.5">Named color sets for quick styling</p>
        </div>
        {mode === "idle" && (
          <button
            onClick={() => setMode("creating")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 text-smoke-100 rounded transition-colors"
          >
            <Plus size={12} />
            New Palette
          </button>
        )}
      </div>

      {mode !== "idle" && (
        <PaletteForm
          key={editTarget?.id ?? "new"}
          initial={formInitial}
          folders={folders}
          onSave={handleSave}
          onCancel={cancel}
        />
      )}

      {isLoading ? (
        <p className="text-xs text-smoke-500">Loading…</p>
      ) : palettes.length === 0 ? (
        <p className="text-xs text-smoke-500 py-6 text-center">
          No palettes yet. Create your first one above.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {palettes.map((p) => (
            <PaletteCard
              key={p.id}
              palette={p}
              linkedFolder={linkedFolder(p.id)}
              onEdit={() => startEdit(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
