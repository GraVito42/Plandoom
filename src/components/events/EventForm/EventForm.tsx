"use client"

import { useState } from "react"
import type { ApiEvent, VisualStyle, RepetitionConfig } from "@/types"
import StyleTab from "./tabs/StyleTab"
import ContentTab from "./tabs/ContentTab"
import type { ContentDraft } from "./tabs/ContentTab"
import FolderTab from "./tabs/FolderTab"
import LindoPanel from "./panels/LindoPanel"
import SeendoPanel from "./panels/SeendoPanel"
import ProDoPanel from "./panels/ProDoPanel"

const DEFAULT_VISUAL_STYLE: VisualStyle = {
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
}

function parseVisualStyle(raw: unknown): VisualStyle {
  if (!raw || typeof raw !== "object") return DEFAULT_VISUAL_STYLE
  const r = raw as Record<string, unknown>
  return {
    shape: (r.shape as VisualStyle["shape"]) ?? "rounded",
    frameColor: (r.frameColor as string) ?? "transparent",
    frameWidth: (r.frameWidth as number) ?? 1,
    sideColor: (r.sideColor as string) ?? "#c9a84c",
    sideWidth: (r.sideWidth as number) ?? 2,
    fillColor: (r.fillColor as string) ?? "#162d5e",
    textColor: (r.textColor as string) ?? "#d1d5db",
    fontFamily: (r.fontFamily as string) ?? "inherit",
    hasCheckbox: (r.hasCheckbox as boolean) ?? false,
    isChecked: (r.isChecked as boolean) ?? false,
    eventType: (r.eventType as string) ?? "default",
  }
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

type MainTab = "style" | "content" | "folder"
type BottomTab = "lindo" | "seendo" | "prodo"

type EventDraft = ContentDraft & {
  visualStyle: VisualStyle
  isExternalLinked: boolean
  mentalEnergy: number
  physicalEnergy: number
  difficulty: number
  pleasure: number
  isFixed: boolean
  productivityModel: string
  folderFieldValues: Record<string, unknown>
}

function initDraft(
  event: ApiEvent | null,
  date: Date | null,
  startHour: number | null,
  prefillTitle?: string,
  prefillDescription?: string,
): EventDraft {
  if (event) {
    const s = new Date(event.startTime)
    const e = new Date(event.endTime)
    return {
      title: event.title,
      description: event.description ?? "",
      startDate: toLocalDate(s),
      startTime: toLocalTime(s),
      endDate: toLocalDate(e),
      endTime: toLocalTime(e),
      isFullDay: event.isFullDay,
      timezone: event.timezone ?? "",
      qualitativeTiming: event.qualitativeTiming ?? "",
      location: event.location ?? "",
      locationUrl: event.locationUrl ?? "",
      repetition: (event.repetition as RepetitionConfig | null) ?? null,
      folderId: event.folderId ?? "",
      visualStyle: parseVisualStyle(event.visualStyle),
      isExternalLinked: event.isExternalLinked,
      mentalEnergy: event.mentalEnergy ?? 50,
      physicalEnergy: event.physicalEnergy ?? 50,
      difficulty: event.difficulty ?? 50,
      pleasure: event.pleasure ?? 50,
      isFixed: event.isFixed,
      productivityModel: event.productivityModel ?? "",
      folderFieldValues: (event.folderFieldValues as Record<string, unknown>) ?? {},
    }
  }

  const base = date ?? new Date()
  const hour = startHour ?? new Date().getHours()
  const start = new Date(base)
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(Math.min(hour + 1, 23), 0, 0, 0)

  return {
    title: prefillTitle ?? "",
    description: prefillDescription ?? "",
    startDate: toLocalDate(start),
    startTime: toLocalTime(start),
    endDate: toLocalDate(start),
    endTime: toLocalTime(end),
    isFullDay: false,
    timezone: "",
    qualitativeTiming: "",
    location: "",
    locationUrl: "",
    repetition: null,
    folderId: "",
    visualStyle: DEFAULT_VISUAL_STYLE,
    isExternalLinked: false,
    mentalEnergy: 50,
    physicalEnergy: 50,
    difficulty: 50,
    pleasure: 50,
    isFixed: false,
    productivityModel: "",
    folderFieldValues: {},
  }
}

interface EventFormProps {
  date: Date | null
  startHour: number | null
  eventToEdit: ApiEvent | null
  prefillTitle?: string
  prefillDescription?: string
  onSave: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export default function EventForm({
  date,
  startHour,
  eventToEdit,
  prefillTitle,
  prefillDescription,
  onSave,
  onDelete,
  onClose,
}: EventFormProps) {
  const [draft, setDraft] = useState<EventDraft>(() =>
    initDraft(eventToEdit, date, startHour, prefillTitle, prefillDescription)
  )
  const [mainTab, setMainTab] = useState<MainTab>("content")
  const [bottomTab, setBottomTab] = useState<BottomTab | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function patch(partial: Partial<EventDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function patchContent(partial: Partial<ContentDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function patchVS(partial: Partial<VisualStyle>) {
    setDraft((prev) => ({ ...prev, visualStyle: { ...prev.visualStyle, ...partial } }))
  }

  function setFieldValue(fieldId: string, value: unknown) {
    setDraft((prev) => ({
      ...prev,
      folderFieldValues: { ...prev.folderFieldValues, [fieldId]: value },
    }))
  }

  async function save() {
    if (!draft.title.trim()) return
    setSaving(true)
    try {
      const startISO = new Date(`${draft.startDate}T${draft.startTime}:00`).toISOString()
      const endISO = new Date(`${draft.endDate}T${draft.endTime}:00`).toISOString()

      const body = {
        title: draft.title.trim(),
        description: draft.description || undefined,
        startTime: startISO,
        endTime: endISO,
        isFlexible: false,
        isFullDay: draft.isFullDay,
        timezone: draft.timezone || undefined,
        qualitativeTiming: draft.qualitativeTiming || undefined,
        location: draft.location || undefined,
        locationUrl: draft.locationUrl || undefined,
        repetition: draft.repetition ?? undefined,
        folderId: draft.folderId || undefined,
        visualStyle: draft.visualStyle,
        isExternalLinked: draft.isExternalLinked,
        mentalEnergy: draft.mentalEnergy,
        physicalEnergy: draft.physicalEnergy,
        difficulty: draft.difficulty,
        pleasure: draft.pleasure,
        isFixed: draft.isFixed,
        productivityModel: draft.productivityModel || undefined,
        folderFieldValues: Object.keys(draft.folderFieldValues).length > 0 ? draft.folderFieldValues : undefined,
      }

      if (eventToEdit) {
        await fetch(`/api/events/${eventToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }

      await onSave()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!eventToEdit) return
    setDeleting(true)
    try {
      await onDelete(eventToEdit.id)
    } finally {
      setDeleting(false)
    }
  }

  const MAIN_TABS: { id: MainTab; label: string }[] = [
    { id: "style", label: "Style" },
    { id: "content", label: "Content" },
    { id: "folder", label: "Folder" },
  ]

  const BOTTOM_TABS: { id: BottomTab; label: string }[] = [
    { id: "lindo", label: "Lindo" },
    { id: "seendo", label: "Seendo" },
    { id: "prodo", label: "Prodo" },
  ]

  const seendoImages = Array.isArray(draft.visualStyle)
    ? []
    : (eventToEdit?.seendoImages as string[] | null) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-smoke-700 shrink-0">
          <h2 className="text-sm font-semibold text-smoke-200 truncate">
            {eventToEdit ? eventToEdit.title || "Edit event" : "New event"}
          </h2>
          <button
            onClick={onClose}
            className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none ml-2 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Main tab bar */}
        <div className="flex border-b border-smoke-700 shrink-0">
          {MAIN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMainTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-medium tracking-wide transition-colors border-b-2 ${
                mainTab === t.id
                  ? "text-doom-gold border-doom-gold"
                  : "text-smoke-500 border-transparent hover:text-smoke-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Main tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {mainTab === "style" && (
            <StyleTab vs={draft.visualStyle} onChange={patchVS} />
          )}
          {mainTab === "content" && (
            <ContentTab draft={draft} onChange={patchContent} />
          )}
          {mainTab === "folder" && (
            <FolderTab
              folderId={draft.folderId}
              folderFieldValues={draft.folderFieldValues}
              onFieldValueChange={setFieldValue}
            />
          )}
        </div>

        {/* Golem bottom bar */}
        <div className="border-t border-smoke-700 shrink-0">
          <div className="flex">
            {BOTTOM_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setBottomTab(bottomTab === t.id ? null : t.id)}
                className={`flex-1 py-2 text-[10px] font-medium tracking-widest uppercase transition-colors border-b-2 ${
                  bottomTab === t.id
                    ? "text-doom-gold border-doom-gold"
                    : "text-smoke-600 border-transparent hover:text-smoke-400"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {bottomTab !== null && (
            <div className="px-5 py-3 max-h-48 overflow-y-auto border-t border-smoke-800">
              {bottomTab === "lindo" && (
                <LindoPanel
                  isExternalLinked={draft.isExternalLinked}
                  onChange={(v) => patch({ isExternalLinked: v })}
                />
              )}
              {bottomTab === "seendo" && (
                <SeendoPanel
                  seendoImages={seendoImages}
                  eventId={eventToEdit?.id ?? null}
                />
              )}
              {bottomTab === "prodo" && (
                <ProDoPanel draft={draft} onChange={patch} />
              )}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-smoke-700 shrink-0">
          <div>
            {eventToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs text-doom-ember hover:text-doom-ember/80 disabled:opacity-40 transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
              {saving ? "Saving…" : eventToEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
