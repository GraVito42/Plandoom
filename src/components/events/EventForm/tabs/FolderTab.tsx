"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ApiFolder, ApiFolderField, FolderFieldType } from "@/types"

const FIELD_TYPES: { value: FolderFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "closed_list", label: "List" },
  { value: "boolean", label: "Yes/No" },
]

function input(extra?: string) {
  return `bg-smoke-800 border border-smoke-700 text-smoke-100 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-smoke-500 ${extra ?? ""}`
}

interface FolderTabProps {
  folderId: string
  folderFieldValues: Record<string, unknown>
  onFieldValueChange: (fieldId: string, value: unknown) => void
}

function FieldValueInput({
  field,
  value,
  onChange,
}: {
  field: ApiFolderField
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (field.fieldType === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-doom-gold"
        />
        <span className="text-sm text-smoke-300">{field.name}</span>
      </label>
    )
  }

  if (field.fieldType === "closed_list") {
    return (
      <div>
        <label className="block text-[10px] text-smoke-500 mb-1">{field.name}</label>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={input("w-full")}
        >
          <option value="">— select —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (field.fieldType === "number") {
    return (
      <div>
        <label className="block text-[10px] text-smoke-500 mb-1">{field.name}</label>
        <input
          type="number"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          className={input("w-full")}
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-[10px] text-smoke-500 mb-1">{field.name}</label>
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className={input("w-full")}
      />
    </div>
  )
}

function AddFieldForm({ folderId, onAdded }: { folderId: string; onAdded: () => void }) {
  const [name, setName] = useState("")
  const [fieldType, setFieldType] = useState<FolderFieldType>("text")
  const [optionsRaw, setOptionsRaw] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const options = fieldType === "closed_list"
        ? optionsRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined
      await fetch("/api/folder-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, name: name.trim(), fieldType, options }),
      })
      setName("")
      setOptionsRaw("")
      setFieldType("text")
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 mt-3 pt-3 border-t border-smoke-700">
      <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Add field to folder</span>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Field name"
        className={input("w-full")}
      />
      <select
        value={fieldType}
        onChange={(e) => setFieldType(e.target.value as FolderFieldType)}
        className={input("w-full")}
      >
        {FIELD_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      {fieldType === "closed_list" && (
        <input
          type="text"
          value={optionsRaw}
          onChange={(e) => setOptionsRaw(e.target.value)}
          placeholder="Option1, Option2, Option3"
          className={input("w-full text-xs")}
        />
      )}
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="px-3 py-1.5 text-xs bg-smoke-700 text-smoke-200 hover:bg-smoke-600 disabled:opacity-40 rounded transition-colors"
      >
        {saving ? "Adding…" : "⊕ Add field"}
      </button>
    </form>
  )
}

export default function FolderTab({ folderId, folderFieldValues, onFieldValueChange }: FolderTabProps) {
  const queryClient = useQueryClient()

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      return res.json() as Promise<ApiFolder[]>
    },
  })

  const { data: fields = [], refetch: refetchFields } = useQuery<ApiFolderField[]>({
    queryKey: ["folder-fields", folderId],
    queryFn: async () => {
      if (!folderId) return []
      const res = await fetch(`/api/folder-fields?folderId=${folderId}`)
      return res.json() as Promise<ApiFolderField[]>
    },
    enabled: !!folderId,
  })

  if (!folderId) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-smoke-500">
        Select a folder in the Content tab to see its custom fields
      </div>
    )
  }

  const folder = folders.find((f) => f.id === folderId)

  return (
    <div className="flex flex-col gap-3 py-1">
      {folder && (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: folder.color ?? "#484e55" }}
          />
          <span className="text-sm font-medium text-smoke-200">{folder.name}</span>
        </div>
      )}

      {fields.length === 0 && (
        <p className="text-xs text-smoke-500">No custom fields yet. Add one below.</p>
      )}

      <div className="flex flex-col gap-3">
        {fields.map((field) => (
          <FieldValueInput
            key={field.id}
            field={field}
            value={folderFieldValues[field.id]}
            onChange={(v) => onFieldValueChange(field.id, v)}
          />
        ))}
      </div>

      <AddFieldForm
        folderId={folderId}
        onAdded={async () => {
          await refetchFields()
          queryClient.invalidateQueries({ queryKey: ["folder-fields"] })
        }}
      />
    </div>
  )
}
