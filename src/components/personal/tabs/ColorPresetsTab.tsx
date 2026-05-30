"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2, Plus, X } from "lucide-react"
import type { ApiPalette, ApiFolder } from "@/types"

const MAX_COLORS = 12
const ACTIVE_PALETTE_KEY = "plandoom_active_palette"
const FALLBACK_COLORS = ["#050818", "#0f2044", "#162d5e", "#2a4d96", "#c9a84c", "#d1d5db", "#9ca3af", "#484e55"]

// ── SwatchBar ─────────────────────────────────────────────────────────────────

function SwatchBar({ colors }: { colors: string[] }) {
  const shown = colors.slice(0, MAX_COLORS)
  return (
    <div className="flex gap-px flex-shrink-0">
      {shown.map((c, i) => (
        <div
          key={i}
          className="w-5 h-5"
          style={{
            background: c,
            borderRadius:
              shown.length === 1
                ? "3px"
                : i === 0
                  ? "3px 0 0 3px"
                  : i === shown.length - 1
                    ? "0 3px 3px 0"
                    : undefined,
          }}
        />
      ))}
    </div>
  )
}

// ── DefaultRow ────────────────────────────────────────────────────────────────

function DefaultRow({
  palettes,
  folders,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}: {
  palettes: ApiPalette[]
  folders: ApiFolder[]
  isEditing: boolean
  onEdit: () => void
  onSave: (data: PaletteFormData) => Promise<void>
  onCancel: () => void
}) {
  const [activePaletteId, setActivePaletteId] = useState<string | null>(null)

  useEffect(() => {
    const read = () => setActivePaletteId(localStorage.getItem(ACTIVE_PALETTE_KEY))
    read()
    window.addEventListener("storage", read)
    window.addEventListener("plandoom:active-palette-changed", read)
    return () => {
      window.removeEventListener("storage", read)
      window.removeEventListener("plandoom:active-palette-changed", read)
    }
  }, [])

  const active = palettes.find((p) => p.id === activePaletteId) ?? palettes[0] ?? null

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
          isEditing
            ? "border-doom-gold/60 bg-navy-800/60"
            : "border-doom-gold/30 bg-navy-800/60"
        }`}
      >
        <span className="text-[10px] font-semibold text-doom-gold uppercase tracking-widest w-28 shrink-0">
          Default
        </span>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <SwatchBar colors={active ? active.colors : FALLBACK_COLORS} />
          {active && (
            <span className="text-[10px] text-smoke-500 truncate">{active.name}</span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="p-1.5 text-smoke-500 hover:text-smoke-200 rounded hover:bg-smoke-800 transition-colors shrink-0"
        >
          <Pencil size={12} />
        </button>
      </div>
      {isEditing && (
        <PaletteForm
          key="default"
          initial={{
            name: active?.name ?? "Default",
            colors: active ? active.colors : FALLBACK_COLORS,
            linkedFolderId: null,
          }}
          folders={folders}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

// ── PaletteForm ───────────────────────────────────────────────────────────────

type PaletteFormData = { name: string; colors: string[]; linkedFolderId: string | null }

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
      className="flex flex-col gap-3 p-3 border border-smoke-700 rounded-lg bg-navy-900/60"
    >
      {/* Name */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] text-smoke-500 uppercase tracking-wider w-14 shrink-0">
          Name
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My palette"
          maxLength={100}
          className="flex-1 bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 placeholder:text-smoke-600 focus:outline-none focus:border-doom-gold/50"
        />
      </div>

      {/* Colors */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-smoke-500 uppercase tracking-wider">
          Colors{" "}
          <span className="text-smoke-600 normal-case">({colors.length}/{MAX_COLORS})</span>
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
                className="w-16 bg-transparent text-[10px] text-smoke-300 focus:outline-none font-mono"
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
      <div className="flex items-center gap-3">
        <label className="text-[10px] text-smoke-500 uppercase tracking-wider w-14 shrink-0">
          Folder
        </label>
        <select
          value={linkedFolderId ?? ""}
          onChange={(e) => setLinkedFolderId(e.target.value || null)}
          className="flex-1 bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 focus:outline-none focus:border-doom-gold/50"
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
      <div className="flex gap-2 justify-end pt-1">
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

// ── PaletteRow ────────────────────────────────────────────────────────────────

function PaletteRow({
  palette,
  linkedFolder,
  isEditing,
  onEdit,
  onDelete,
}: {
  palette: ApiPalette
  linkedFolder: ApiFolder | undefined
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        isEditing
          ? "border-doom-gold/40 bg-navy-800/40"
          : "border-smoke-700 bg-smoke-900/30 hover:border-smoke-600"
      }`}
    >
      <span className="text-xs text-smoke-200 w-28 shrink-0 truncate" title={palette.name}>
        {palette.name}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <SwatchBar colors={palette.colors} />
        {linkedFolder && (
          <span className="text-[10px] text-smoke-600 truncate">📁 {linkedFolder.name}</span>
        )}
      </div>
      <div className="flex gap-0.5 shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 text-smoke-500 hover:text-smoke-200 rounded hover:bg-smoke-800 transition-colors"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-smoke-500 hover:text-doom-ember rounded hover:bg-smoke-800 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── ColorPresetsTab ───────────────────────────────────────────────────────────

export default function ColorPresetsTab() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | "new" | "default" | null>(null)

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

  async function handleDefaultSave(data: PaletteFormData) {
    const activePaletteId = localStorage.getItem(ACTIVE_PALETTE_KEY)
    if (activePaletteId) {
      await fetch(`/api/palettes/${activePaletteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, colors: data.colors }),
      })
    } else {
      const res = await fetch("/api/palettes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, type: "personal", colors: data.colors }),
      })
      if (res.ok) {
        const newPalette = (await res.json()) as ApiPalette
        localStorage.setItem(ACTIVE_PALETTE_KEY, newPalette.id)
        window.dispatchEvent(new CustomEvent("plandoom:active-palette-changed"))
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["palettes"] })
    setEditingId(null)
  }

  async function handleSave(data: PaletteFormData) {
    if (editingId === "new") {
      const res = await fetch("/api/palettes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, type: "personal", colors: data.colors }),
      })
      if (res.ok && data.linkedFolderId) {
        const newPalette = (await res.json()) as ApiPalette
        await patchFolderPaletteId(data.linkedFolderId, newPalette.id)
      }
    } else if (editingId) {
      await fetch(`/api/palettes/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, colors: data.colors }),
      })
      const oldFolderId = linkedFolder(editingId)?.id ?? null
      if (oldFolderId !== data.linkedFolderId) {
        if (oldFolderId) await patchFolderPaletteId(oldFolderId, null)
        if (data.linkedFolderId) await patchFolderPaletteId(data.linkedFolderId, editingId)
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["palettes"] })
    await queryClient.invalidateQueries({ queryKey: ["folders"] })
    setEditingId(null)
  }

  async function handleDelete(palette: ApiPalette) {
    const lf = linkedFolder(palette.id)
    if (lf) await patchFolderPaletteId(lf.id, null)
    await fetch(`/api/palettes/${palette.id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["palettes"] })
    await queryClient.invalidateQueries({ queryKey: ["folders"] })
    if (editingId === palette.id) setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-smoke-100">Color Palettes</h2>
        <p className="text-[10px] text-smoke-500 mt-0.5">Named color sets for quick styling</p>
      </div>

      {/* DEFAULT row */}
      <DefaultRow
        palettes={palettes}
        folders={folders}
        isEditing={editingId === "default"}
        onEdit={() => setEditingId(editingId === "default" ? null : "default")}
        onSave={handleDefaultSave}
        onCancel={() => setEditingId(null)}
      />

      <div className="border-t border-smoke-800" />

      {/* Palette list */}
      {isLoading ? (
        <p className="text-xs text-smoke-500">Loading…</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {palettes.length === 0 && editingId !== "new" && (
            <p className="text-xs text-smoke-500 py-3 text-center">No palettes yet.</p>
          )}

          {palettes.map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5">
              <PaletteRow
                palette={p}
                linkedFolder={linkedFolder(p.id)}
                isEditing={editingId === p.id}
                onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
                onDelete={() => handleDelete(p)}
              />
              {editingId === p.id && (
                <PaletteForm
                  key={p.id}
                  initial={{
                    name: p.name,
                    colors: p.colors,
                    linkedFolderId: linkedFolder(p.id)?.id ?? null,
                  }}
                  folders={folders}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          ))}

          {editingId === "new" && (
            <PaletteForm
              key="new"
              initial={{ name: "", colors: ["#c9a84c"], linkedFolderId: null }}
              folders={folders}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          )}
        </div>
      )}

      {/* Add button — bottom, hidden while creating */}
      {editingId !== "new" && (
        <button
          onClick={() => setEditingId("new")}
          className="flex items-center gap-1.5 self-start px-3 py-1.5 text-xs text-smoke-400 hover:text-smoke-200 border border-dashed border-smoke-700 hover:border-smoke-500 rounded transition-colors mt-1"
        >
          <Plus size={12} />
          Add Palette
        </button>
      )}
    </div>
  )
}
