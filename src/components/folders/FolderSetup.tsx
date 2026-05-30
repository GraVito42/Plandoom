"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { VisualStyle, FolderSymbol, ApiFolderField } from "@/types"
import { PX_PER_HOUR } from "@/hooks/useGrid"
import StyleTab from "@/components/events/EventForm/tabs/StyleTab"

type FieldType = "text" | "number" | "closed_list" | "boolean"

type DraftField = {
  _key: string
  name: string
  fieldType: FieldType
  options: string[]
  newOption: string
}

type ActiveTab = "details" | "style" | "fields"

type FolderLike = {
  id: string
  name: string
  color: string | null
  icon: string | null
  visualStyle: unknown
}

const DEFAULT_FOLDER_STYLE: VisualStyle = {
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

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "closed_list", label: "List" },
  { value: "boolean", label: "Checkbox" },
]

const TABS: { id: ActiveTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "style", label: "Style" },
  { id: "fields", label: "Fields" },
]

function parseExistingVisualStyle(raw: unknown): VisualStyle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_FOLDER_STYLE
  const r = raw as Record<string, unknown>
  return {
    shape: (["rectangle", "rounded", "pill"].includes(r.shape as string)
      ? r.shape : "rounded") as VisualStyle["shape"],
    frameColor: typeof r.frameColor === "string" ? r.frameColor : "transparent",
    frameWidth: typeof r.frameWidth === "number" ? r.frameWidth : 1,
    sideColor: typeof r.sideColor === "string" ? r.sideColor : "#c9a84c",
    sideWidth: typeof r.sideWidth === "number" ? r.sideWidth : 2,
    fillColor: typeof r.fillColor === "string" ? r.fillColor : "#162d5e",
    fillOpacity: typeof r.fillOpacity === "number" ? r.fillOpacity : 100,
    textColor: typeof r.textColor === "string" ? r.textColor : "#d1d5db",
    fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : "inherit",
    hasCheckbox: typeof r.hasCheckbox === "boolean" ? r.hasCheckbox : false,
    isChecked: typeof r.isChecked === "boolean" ? r.isChecked : false,
    eventType: typeof r.eventType === "string" ? r.eventType : "default",
    shapePath: typeof r.shapePath === "string" ? r.shapePath : null,
    shapeSmoothing: typeof r.shapeSmoothing === "number" ? r.shapeSmoothing : 0,
    textPosition: (() => {
      const tp = r.textPosition as { x: number; y: number } | null | undefined
      return tp && typeof tp.x === "number" && typeof tp.y === "number" ? tp : null
    })(),
    widthPercent: typeof r.widthPercent === "number" ? r.widthPercent : 100,
    leftOffset: typeof r.leftOffset === "number" ? r.leftOffset : 0,
  }
}

function parseFolderSymbol(raw: unknown): FolderSymbol | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const fs = r.folderSymbol
  if (!fs || typeof fs !== "object" || Array.isArray(fs)) return null
  const f = fs as Record<string, unknown>
  if (typeof f.color !== "string") return null
  const pos = f.position
  return {
    icon: typeof f.icon === "string" ? f.icon : null,
    customImage: typeof f.customImage === "string" ? f.customImage : null,
    color: f.color,
    size: typeof f.size === "number" ? f.size : f.size === "sm" ? 16 : f.size === "lg" ? 40 : 24,
    position:
      pos && typeof pos === "object" && !Array.isArray(pos) &&
      typeof (pos as Record<string, unknown>).x === "number" &&
      typeof (pos as Record<string, unknown>).y === "number"
        ? { x: (pos as Record<string, unknown>).x as number, y: (pos as Record<string, unknown>).y as number }
        : null,
  }
}

// ── Edit-mode fields tab ──────────────────────────────────────────────────────

function EditFieldsTab({ folderId }: { folderId: string }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<FieldType>("text")
  const [newOptions, setNewOptions] = useState("")
  const [saving, setSaving] = useState(false)

  const { data: fields = [], refetch } = useQuery<ApiFolderField[]>({
    queryKey: ["folder-fields", folderId],
    queryFn: async () => {
      const res = await fetch(`/api/folder-fields?folderId=${folderId}`)
      return res.json() as Promise<ApiFolderField[]>
    },
  })

  async function deleteField(id: string) {
    await fetch(`/api/folder-fields/${id}`, { method: "DELETE" })
    await refetch()
    queryClient.invalidateQueries({ queryKey: ["folder-fields"] })
  }

  async function addField() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const options = newType === "closed_list"
        ? newOptions.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined
      await fetch("/api/folder-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, name: newName.trim(), fieldType: newType, options }),
      })
      setNewName("")
      setNewOptions("")
      setNewType("text")
      setAdding(false)
      await refetch()
      queryClient.invalidateQueries({ queryKey: ["folder-fields"] })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] text-smoke-500">
        These fields appear in the event and chip form when this folder is selected.
      </p>

      {fields.map((f) => (
        <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-smoke-800/60 rounded-lg border border-smoke-700">
          <span className="flex-1 text-xs text-smoke-200 truncate">{f.name}</span>
          <span className="text-[10px] text-smoke-500 bg-smoke-700 px-1.5 py-0.5 rounded">{f.fieldType}</span>
          <button
            type="button"
            onClick={() => void deleteField(f.id)}
            className="text-smoke-500 hover:text-doom-ember transition-colors text-sm leading-none ml-1"
          >
            ✕
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex flex-col gap-2 p-3 bg-smoke-800/60 rounded-lg border border-smoke-700">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Field name"
            autoFocus
            className="bg-smoke-900 border border-smoke-700 text-smoke-100 text-xs rounded px-2 py-1 focus:outline-none focus:border-smoke-500"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as FieldType)}
            className="bg-smoke-900 border border-smoke-700 text-smoke-200 text-xs rounded px-1.5 py-1 focus:outline-none"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {newType === "closed_list" && (
            <input
              type="text"
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Option1, Option2"
              className="bg-smoke-900 border border-smoke-700 text-smoke-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-doom-gold/40"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void addField()}
              disabled={saving || !newName.trim()}
              className="px-3 py-1 text-xs bg-doom-gold text-navy-950 rounded hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
            >
              {saving ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setNewName(""); setNewOptions(""); setNewType("text") }}
              className="px-3 py-1 text-xs text-smoke-400 hover:text-smoke-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start flex items-center gap-1.5 text-xs text-smoke-400 hover:text-smoke-200 border border-smoke-700 hover:border-smoke-500 rounded px-2.5 py-1 transition-colors"
        >
          <span className="text-doom-gold text-sm leading-none">+</span> Add field
        </button>
      )}
    </div>
  )
}

// ── FolderSetup ───────────────────────────────────────────────────────────────

interface FolderSetupProps {
  folderToEdit?: FolderLike
  onClose: () => void
}

export default function FolderSetup({ folderToEdit, onClose }: FolderSetupProps) {
  const queryClient = useQueryClient()
  const isEdit = !!folderToEdit

  const [activeTab, setActiveTab] = useState<ActiveTab>("details")
  const [name, setName] = useState(folderToEdit?.name ?? "")
  const [color, setColor] = useState(folderToEdit?.color ?? "")
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(
    isEdit ? parseExistingVisualStyle(folderToEdit?.visualStyle) : DEFAULT_FOLDER_STYLE
  )
  const [folderSymbol, setFolderSymbol] = useState<FolderSymbol | null>(
    isEdit ? parseFolderSymbol(folderToEdit?.visualStyle) : null
  )
  const [fields, setFields] = useState<DraftField[]>([])
  const [saving, setSaving] = useState(false)

  // Create-mode field helpers
  function addField() {
    setFields((prev) => [
      ...prev,
      { _key: Date.now().toString(), name: "", fieldType: "text", options: [], newOption: "" },
    ])
  }

  function updateField(key: string, patch: Partial<DraftField>) {
    setFields((prev) => prev.map((f) => f._key === key ? { ...f, ...patch } : f))
  }

  function removeField(key: string) {
    setFields((prev) => prev.filter((f) => f._key !== key))
  }

  function addOption(key: string, option: string) {
    const opt = option.trim()
    if (!opt) return
    setFields((prev) => prev.map((f) =>
      f._key === key ? { ...f, options: [...f.options, opt], newOption: "" } : f
    ))
  }

  function removeOption(key: string, idx: number) {
    setFields((prev) => prev.map((f) =>
      f._key === key ? { ...f, options: f.options.filter((_, i) => i !== idx) } : f
    ))
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const vsWithSymbol = folderSymbol
        ? { ...visualStyle, folderSymbol }
        : { ...visualStyle, folderSymbol: null }

      if (isEdit && folderToEdit) {
        await fetch(`/api/folders/${folderToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            color: color.trim() || null,
            visualStyle: vsWithSymbol,
          }),
        })
      } else {
        const folderRes = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), color: color.trim() || undefined, visualStyle: vsWithSymbol }),
        })
        if (!folderRes.ok) throw new Error("Failed to create folder")
        const folder = await folderRes.json() as { id: string }

        for (let i = 0; i < fields.length; i++) {
          const f = fields[i]
          if (!f.name.trim()) continue
          await fetch("/api/folder-fields", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folderId: folder.id,
              name: f.name.trim(),
              fieldType: f.fieldType,
              options: f.fieldType === "closed_list" && f.options.length > 0 ? f.options : undefined,
              order: i,
            }),
          })
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["folders"] })
      onClose()
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
          <h2 className="text-sm font-semibold text-smoke-200">{isEdit ? "Edit Folder" : "New Folder"}</h2>
          <button onClick={onClose} className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none">✕</button>
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

          {/* Details tab */}
          {activeTab === "details" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">Folder name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setActiveTab("style") }}
                  placeholder="e.g. Lectures, Work, Personal"
                  autoFocus={!isEdit}
                  className="w-full bg-smoke-800 border border-smoke-700 text-smoke-100 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-smoke-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color || "#162d5e"}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-7 rounded border border-smoke-700 cursor-pointer bg-transparent p-0.5"
                  />
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#162d5e"
                    className="flex-1 bg-smoke-800 border border-smoke-700 text-smoke-200 text-xs font-mono rounded px-2 py-1.5 focus:outline-none focus:border-smoke-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-smoke-600">
                The Style tab sets the default visual style for events in this folder, including the folder symbol.
                The Fields tab lets you add custom data fields.
              </p>
            </div>
          )}

          {/* Style tab */}
          {activeTab === "style" && (
            <StyleTab
              vs={visualStyle}
              onChange={(patch) => setVisualStyle((prev) => ({ ...prev, ...patch }))}
              durationPx={PX_PER_HOUR}
              folderSymbol={folderSymbol}
              onFolderSymbol={setFolderSymbol}
            />
          )}

          {/* Fields tab */}
          {activeTab === "fields" && (
            isEdit && folderToEdit ? (
              <EditFieldsTab folderId={folderToEdit.id} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] text-smoke-500">
                  These fields appear in the event and chip form when this folder is selected.
                </p>

                {fields.map((f) => (
                  <div
                    key={f._key}
                    className="flex flex-col gap-2 p-3 bg-smoke-800/60 rounded-lg border border-smoke-700"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => updateField(f._key, { name: e.target.value })}
                        placeholder="Field name"
                        className="flex-1 bg-smoke-900 border border-smoke-700 text-smoke-100 text-xs rounded px-2 py-1 focus:outline-none focus:border-smoke-500"
                      />
                      <select
                        value={f.fieldType}
                        onChange={(e) => updateField(f._key, { fieldType: e.target.value as FieldType, options: [], newOption: "" })}
                        className="bg-smoke-900 border border-smoke-700 text-smoke-200 text-xs rounded px-1.5 py-1 focus:outline-none"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeField(f._key)}
                        className="text-smoke-500 hover:text-doom-ember transition-colors text-sm leading-none"
                      >
                        ✕
                      </button>
                    </div>

                    {f.fieldType === "closed_list" && (
                      <div className="flex flex-col gap-1.5 pl-1">
                        {f.options.map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="flex-1 text-xs text-smoke-300 bg-smoke-900 px-2 py-0.5 rounded">{opt}</span>
                            <button
                              type="button"
                              onClick={() => removeOption(f._key, idx)}
                              className="text-smoke-600 hover:text-doom-ember transition-colors text-xs leading-none"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-1 mt-0.5">
                          <input
                            type="text"
                            value={f.newOption}
                            onChange={(e) => updateField(f._key, { newOption: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); addOption(f._key, f.newOption) }
                            }}
                            placeholder="Add option…"
                            className="flex-1 bg-smoke-900 border border-smoke-700 text-smoke-200 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-doom-gold/40"
                          />
                          <button
                            type="button"
                            onClick={() => addOption(f._key, f.newOption)}
                            disabled={!f.newOption.trim()}
                            className="text-xs text-doom-gold hover:text-doom-gold/80 disabled:opacity-30 px-1 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addField}
                  className="self-start flex items-center gap-1.5 text-xs text-smoke-400 hover:text-smoke-200 border border-smoke-700 hover:border-smoke-500 rounded px-2.5 py-1 transition-colors"
                >
                  <span className="text-doom-gold text-sm leading-none">+</span> Add field
                </button>
              </div>
            )
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
            onClick={() => void save()}
            disabled={saving || !name.trim()}
            className="px-4 py-1.5 text-xs font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create folder"}
          </button>
        </div>

      </div>
    </div>
  )
}
