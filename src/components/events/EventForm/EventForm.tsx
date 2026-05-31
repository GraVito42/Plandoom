"use client"

import { useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ApiEvent, VisualStyle, RepetitionConfig, ApiFolder, ApiPalette } from "@/types"
import { PX_PER_HOUR } from "@/hooks/useGrid"
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

function loadDefaultStyle(): VisualStyle {
  if (typeof window === "undefined") return DEFAULT_VISUAL_STYLE
  try {
    const raw = localStorage.getItem("plandoom_default_event_style")
    if (raw) return parseVisualStyle(JSON.parse(raw) as unknown)
  } catch { /* ignore */ }
  return DEFAULT_VISUAL_STYLE
}

function parseVisualStyle(raw: unknown): VisualStyle {
  if (!raw || typeof raw !== "object") return DEFAULT_VISUAL_STYLE
  const r = raw as Record<string, unknown>
  const tp = r.textPosition as { x: number; y: number } | null | undefined
  return {
    shape: (r.shape as VisualStyle["shape"]) ?? "rounded",
    frameColor: (r.frameColor as string) ?? "transparent",
    frameWidth: (r.frameWidth as number) ?? 1,
    sideColor: (r.sideColor as string) ?? "#c9a84c",
    sideWidth: (r.sideWidth as number) ?? 2,
    fillColor: (r.fillColor as string) ?? "#162d5e",
    fillOpacity: typeof r.fillOpacity === "number" ? r.fillOpacity : 100,
    textColor: (r.textColor as string) ?? "#d1d5db",
    fontFamily: (r.fontFamily as string) ?? "inherit",
    hasCheckbox: (r.hasCheckbox as boolean) ?? false,
    isChecked: (r.isChecked as boolean) ?? false,
    eventType: (r.eventType as string) ?? "default",
    shapePath: typeof r.shapePath === "string" ? r.shapePath : null,
    shapeSmoothing: typeof r.shapeSmoothing === "number" ? r.shapeSmoothing : 0,
    textPosition: tp && typeof tp.x === "number" && typeof tp.y === "number" ? tp : null,
    widthPercent: typeof r.widthPercent === "number" ? r.widthPercent : 100,
    leftOffset: typeof r.leftOffset === "number" ? r.leftOffset : 0,
  }
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

// "content" = default center; others replace center with that Golem panel
type CenterView = "content" | "lindo" | "seendo" | "prodo"

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
  prefillFolderId?: string,
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
    folderId: prefillFolderId ?? "",
    visualStyle: loadDefaultStyle(),
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
  prefillFolderId?: string
  onSave: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

const GOLEM_BUTTONS: { id: CenterView; label: string }[] = [
  { id: "lindo", label: "Lindo" },
  { id: "seendo", label: "Seendo" },
  { id: "prodo", label: "Prodo" },
]

const CENTER_LABELS: Record<CenterView, string> = {
  content: "Content",
  lindo: "Lindo",
  seendo: "Seendo",
  prodo: "Prodo",
}

// ── Scope dialog ──────────────────────────────────────────────────────────────

type PendingAction = "save" | "delete" | null

interface ScopeDialogProps {
  action: "save" | "delete"
  onChoose: (scope: "this" | "all") => void
  onCancel: () => void
}

function ScopeDialog({ action, onChoose, onCancel }: ScopeDialogProps) {
  const verb = action === "save" ? "Save changes to" : "Delete"
  return (
    <div className="absolute inset-0 bg-navy-950/75 flex items-center justify-center z-20 rounded-xl backdrop-blur-sm">
      <div className="bg-smoke-800 border border-smoke-600 rounded-xl p-5 flex flex-col gap-4 w-72 shadow-2xl">
        <p className="text-sm text-smoke-200 font-medium">{verb}:</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChoose("this")}
            className="w-full px-4 py-2.5 text-sm text-left rounded-lg bg-smoke-700 hover:bg-smoke-600 text-smoke-100 transition-colors border border-smoke-600 hover:border-smoke-500"
          >
            Only this occurrence
          </button>
          <button
            type="button"
            onClick={() => onChoose("all")}
            className="w-full px-4 py-2.5 text-sm text-left rounded-lg bg-doom-gold/10 hover:bg-doom-gold/20 text-doom-gold border border-doom-gold/30 hover:border-doom-gold/50 transition-colors"
          >
            All occurrences in this series
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-smoke-500 hover:text-smoke-300 transition-colors self-end"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── FolderStylePrompt ─────────────────────────────────────────────────────────

function FolderStylePrompt({ onApply, onKeep }: { onApply: () => void; onKeep: () => void }) {
  return (
    <div className="absolute inset-0 bg-navy-950/75 flex items-center justify-center z-20 rounded-xl backdrop-blur-sm">
      <div className="bg-smoke-800 border border-smoke-600 rounded-xl p-5 flex flex-col gap-4 w-72 shadow-2xl">
        <p className="text-sm text-smoke-200 font-medium">Apply new folder style?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApply}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-doom-gold/10 hover:bg-doom-gold/20 text-doom-gold border border-doom-gold/30 hover:border-doom-gold/50 transition-colors"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onKeep}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-smoke-700 hover:bg-smoke-600 text-smoke-200 border border-smoke-600 hover:border-smoke-500 transition-colors"
          >
            Keep current
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EventForm ─────────────────────────────────────────────────────────────────

export default function EventForm({
  date,
  startHour,
  eventToEdit,
  prefillTitle,
  prefillDescription,
  prefillFolderId,
  onSave,
  onDelete,
  onClose,
}: EventFormProps) {
  const [draft, setDraft] = useState<EventDraft>(() =>
    initDraft(eventToEdit, date, startHour, prefillTitle, prefillDescription, prefillFolderId)
  )
  const [centerView, setCenterView] = useState<CenterView>("content")
  const [styleOpen, setStyleOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [folderStylePending, setFolderStylePending] = useState<VisualStyle | null>(null)

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      if (!res.ok) throw new Error("Failed to load folders")
      return res.json() as Promise<ApiFolder[]>
    },
  })

  const { data: palettes = [] } = useQuery<ApiPalette[]>({
    queryKey: ["palettes"],
    queryFn: async () => {
      const res = await fetch("/api/palettes")
      if (!res.ok) throw new Error("Failed to load palettes")
      return res.json() as Promise<ApiPalette[]>
    },
  })

  // Se il folder dell'evento ha una palette associata, la passa a StyleTab come priorità
  const folderPaletteSwatches = (() => {
    if (!draft.folderId) return undefined
    const folder = folders.find((f) => f.id === draft.folderId)
    const vs = folder?.visualStyle as Record<string, unknown> | null | undefined
    const paletteId = vs?.paletteId as string | undefined
    if (!paletteId) return undefined
    return palettes.find((p) => p.id === paletteId)?.colors
  })()

  // Track the last folderId to distinguish first selection vs folder change
  const prevFolderIdRef = useRef<string>(eventToEdit?.folderId ?? prefillFolderId ?? "")

  // An event is "recurring" only if it's a child occurrence (has parentEventId)
  const isRecurring = !!eventToEdit &&
    eventToEdit.parentEventId !== null &&
    eventToEdit.parentEventId !== undefined

  function patch(partial: Partial<EventDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function patchContent(partial: Partial<ContentDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function patchVS(partial: Partial<VisualStyle>) {
    setDraft((prev) => ({ ...prev, visualStyle: { ...prev.visualStyle, ...partial } }))
  }

  function applyVS(vs: VisualStyle) {
    setDraft((prev) => ({ ...prev, visualStyle: vs }))
  }

  function handleFolderChange(newFolderId: string, folderVisualStyle: unknown) {
    const prevId = prevFolderIdRef.current
    prevFolderIdRef.current = newFolderId

    if (!newFolderId || !folderVisualStyle) return  // clearing or folder has no style

    const newStyle = parseVisualStyle(folderVisualStyle)

    if (!prevId) {
      // First selection: apply immediately
      applyVS(newStyle)
    } else {
      // Changing from one folder to another: ask
      setFolderStylePending(newStyle)
    }
  }

  function setFieldValue(fieldId: string, value: unknown) {
    setDraft((prev) => ({
      ...prev,
      folderFieldValues: { ...prev.folderFieldValues, [fieldId]: value },
    }))
  }

  function toggleGolem(id: CenterView) {
    setCenterView((prev) => (prev === id ? "content" : id))
  }

  // Build the request body from current draft
  function buildBody() {
    const startISO = new Date(`${draft.startDate}T${draft.startTime}:00`).toISOString()
    const endISO = new Date(`${draft.endDate}T${draft.endTime}:00`).toISOString()
    return {
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
      mentalEnergy: draft.mentalEnergy,
      physicalEnergy: draft.physicalEnergy,
      difficulty: draft.difficulty,
      pleasure: draft.pleasure,
      isFixed: draft.isFixed,
      productivityModel: draft.productivityModel || undefined,
      folderFieldValues:
        Object.keys(draft.folderFieldValues).length > 0 ? draft.folderFieldValues : undefined,
    }
  }

  async function doSave(scope: "this" | "all") {
    if (!draft.title.trim()) return
    setSaving(true)
    try {
      const body = buildBody()
      let res: Response

      if (eventToEdit) {
        res = await fetch(`/api/events/${eventToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, scope }),
        })
      } else {
        res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) {
        const raw = await res.text().catch(() => "")
        let errBody: unknown = raw
        try { errBody = JSON.parse(raw) } catch { /* not JSON */ }
        console.error("[EventForm] save failed", res.status, errBody)
        return
      }

      await onSave()
    } catch (err) {
      console.error("[EventForm] save error", err)
    } finally {
      setSaving(false)
    }
  }

  async function doDelete(scope: "this" | "all") {
    if (!eventToEdit) return
    setDeleting(true)
    try {
      if (scope === "all") {
        await fetch(`/api/events/${eventToEdit.id}?scope=all`, { method: "DELETE" })
        await onSave() // refresh grid
      } else {
        await onDelete(eventToEdit.id)
      }
    } finally {
      setDeleting(false)
    }
  }

  function handleSaveClick() {
    if (!draft.title.trim()) return
    if (isRecurring) {
      setPendingAction("save")
      return
    }
    void doSave("this")
  }

  function handleDeleteClick() {
    if (!eventToEdit) return
    if (isRecurring) {
      setPendingAction("delete")
      return
    }
    void doDelete("this")
  }

  function handleScopeChoice(scope: "this" | "all") {
    const action = pendingAction
    setPendingAction(null)
    if (action === "save") void doSave(scope)
    else if (action === "delete") void doDelete(scope)
  }

  const seendoImages = (eventToEdit?.seendoImages as string[] | null) ?? []

  const durationPx = (() => {
    try {
      const s = new Date(`${draft.startDate}T${draft.startTime}:00`)
      const e = new Date(`${draft.endDate}T${draft.endTime}:00`)
      const diffMinutes = Math.max(15, (e.getTime() - s.getTime()) / 60_000)
      return diffMinutes * (PX_PER_HOUR / 60)
    } catch {
      return PX_PER_HOUR
    }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col max-h-[88vh]">

        {/* Scope dialog overlay */}
        {pendingAction && (
          <ScopeDialog
            action={pendingAction}
            onChoose={handleScopeChoice}
            onCancel={() => setPendingAction(null)}
          />
        )}

        {/* Folder style confirmation overlay */}
        {folderStylePending && (
          <FolderStylePrompt
            onApply={() => { applyVS(folderStylePending); setFolderStylePending(null) }}
            onKeep={() => setFolderStylePending(null)}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-smoke-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-smoke-200 truncate">
              {eventToEdit ? (eventToEdit.title || "Edit event") : "New event"}
            </h2>
            {isRecurring && (
              <span className="text-[10px] text-doom-gold/70 shrink-0">↻ recurring</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none ml-4 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Column labels */}
        <div
          className="grid shrink-0 border-b border-smoke-700"
          style={{ gridTemplateColumns: `${styleOpen ? "220px" : "32px"} 1fr ${folderOpen ? "220px" : "32px"}` }}
        >
          <div className="px-2 py-1.5 border-r border-smoke-700 flex items-center justify-between gap-1">
            {styleOpen && <span className="text-[10px] text-smoke-500 uppercase tracking-widest">Style</span>}
            <button
              type="button"
              onClick={() => setStyleOpen((p) => !p)}
              className="text-smoke-500 hover:text-smoke-200 transition-colors ml-auto shrink-0"
            >
              {styleOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
          <div className="px-4 py-1.5 border-r border-smoke-700">
            <span className="text-[10px] text-smoke-500 uppercase tracking-widest">
              {CENTER_LABELS[centerView]}
            </span>
          </div>
          <div className="px-2 py-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFolderOpen((p) => !p)}
              className="text-smoke-500 hover:text-smoke-200 transition-colors shrink-0"
            >
              {folderOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
            {folderOpen && <span className="text-[10px] text-smoke-500 uppercase tracking-widest">Folder Features</span>}
          </div>
        </div>

        {/* Three columns — each scrolls independently */}
        <div
          className="grid flex-1 min-h-0 overflow-hidden divide-x divide-smoke-700"
          style={{ gridTemplateColumns: `${styleOpen ? "220px" : "32px"} 1fr ${folderOpen ? "220px" : "32px"}` }}
        >

          {/* Left — Style */}
          <div className={`min-h-0 ${styleOpen ? "overflow-y-auto px-4 py-3" : "overflow-hidden"}`}>
            {styleOpen && (
              <StyleTab
                vs={draft.visualStyle}
                onChange={patchVS}
                durationPx={durationPx}
                prioritySwatches={folderPaletteSwatches}
              />
            )}
          </div>

          {/* Center — Content or active Golem panel */}
          <div className="overflow-y-auto px-4 py-3">
            {centerView === "content" && (
              <ContentTab
                draft={draft}
                onChange={patchContent}
                onFolderChange={handleFolderChange}
              />
            )}
            {centerView === "lindo" && (
              <LindoPanel
                isExternalLinked={draft.isExternalLinked}
                onChange={(v) => patch({ isExternalLinked: v })}
              />
            )}
            {centerView === "seendo" && (
              <SeendoPanel seendoImages={seendoImages} eventId={eventToEdit?.id ?? null} />
            )}
            {centerView === "prodo" && (
              <ProDoPanel draft={draft} onChange={patch} />
            )}
          </div>

          {/* Right — Folder Features */}
          <div className={`min-h-0 ${folderOpen ? "overflow-y-auto px-4 py-3" : "overflow-hidden"}`}>
            {folderOpen && (
              <FolderTab
                folderId={draft.folderId}
                folderFieldValues={draft.folderFieldValues}
                onFieldValueChange={setFieldValue}
              />
            )}
          </div>

        </div>

        {/* Bottom bar: Delete | Golem toggles | Cancel + Save */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-smoke-700 shrink-0">

          {/* Left: Delete */}
          <div className="w-20 shrink-0">
            {eventToEdit && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={deleting}
                className="px-3 py-1.5 text-xs text-doom-ember hover:text-doom-ember/70 disabled:opacity-40 transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>

          {/* Center: Golem toggle buttons */}
          <div className="flex gap-1.5">
            {GOLEM_BUTTONS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGolem(g.id)}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  centerView === g.id
                    ? "text-doom-gold border-doom-gold/60 bg-navy-800"
                    : "text-smoke-500 border-smoke-700 hover:text-smoke-300 hover:border-smoke-500"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Right: Cancel + Save */}
          <div className="flex gap-2 items-center w-36 justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-smoke-400 hover:text-smoke-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
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
