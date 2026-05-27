"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { VisualStyle } from "@/types"
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

const DEFAULT_FOLDER_STYLE: VisualStyle = {
  shape: "rounded",
  frameColor: "transparent",
  frameWidth: 1,
  sideColor: "#c9a84c",
  sideWidth: 2,
  fillColor: "#162d5e",
  textColor: "#d1d5db",
  fontFamily: "inherit",
  hasCheckbox: false,
  isChecked: false,
  eventType: "default",
  shapePath: null,
  shapeSmoothing: 0,
  textPosition: null,
  widthPercent: 100,
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

interface FolderSetupProps {
  onClose: () => void
}

export default function FolderSetup({ onClose }: FolderSetupProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>("details")
  const [name, setName] = useState("")
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(DEFAULT_FOLDER_STYLE)
  const [fields, setFields] = useState<DraftField[]>([])
  const [saving, setSaving] = useState(false)

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
      const folderRes = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), visualStyle }),
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
          <h2 className="text-sm font-semibold text-smoke-200">New Folder</h2>
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
                  autoFocus
                  className="w-full bg-smoke-800 border border-smoke-700 text-smoke-100 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-smoke-500"
                />
              </div>
              <p className="text-[10px] text-smoke-600">
                The Style tab sets the default visual style for events and chips in this folder.
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
            />
          )}

          {/* Fields tab */}
          {activeTab === "fields" && (
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
            disabled={saving || !name.trim()}
            className="px-4 py-1.5 text-xs font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Create folder"}
          </button>
        </div>

      </div>
    </div>
  )
}
