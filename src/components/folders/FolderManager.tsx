"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as XLSX from "xlsx"
import {
  ChevronLeft, ChevronUp, ChevronDown,
  Briefcase, Star, Heart, Flame, Zap, BookOpen, Tag, Flag,
  Home, Music, Camera, Coffee, Leaf, Globe, Shield, Bell,
} from "lucide-react"
import type { ApiEvent, ApiFolder, ApiFolderField, FolderSymbol } from "@/types"
import FolderSetup from "./FolderSetup"
import EventForm from "../events/EventForm/EventForm"

// ── Types ─────────────────────────────────────────────────────────────────────

type FolderWithCount = ApiFolder & { _count?: { events: number } }
type SortKey = "title" | "startTime" | "endTime"

// ── Folder visual helpers ─────────────────────────────────────────────────────

const SYMBOL_ICONS = {
  Briefcase, Star, Heart, Flame, Zap, BookOpen, Tag, Flag,
  Home, Music, Camera, Coffee, Leaf, Globe, Shield, Bell,
} as const
type SymbolIconName = keyof typeof SYMBOL_ICONS
function resolveSymbolSize(size: unknown): number {
  if (typeof size === "number") return size
  if (size === "sm") return 16
  if (size === "lg") return 40
  return 24
}

function parseFolderMeta(visualStyle: unknown): { fillColor: string | null; folderSymbol: FolderSymbol | null } {
  const vs = visualStyle as Record<string, unknown> | null | undefined
  const fillColor = typeof vs?.fillColor === "string" ? vs.fillColor : null
  const fs = vs?.folderSymbol
  if (!fs || typeof fs !== "object" || Array.isArray(fs)) return { fillColor, folderSymbol: null }
  const f = fs as Record<string, unknown>
  if (typeof f.color !== "string") return { fillColor, folderSymbol: null }
  const pos = f.position
  return {
    fillColor,
    folderSymbol: {
      icon: typeof f.icon === "string" ? f.icon : null,
      customImage: typeof f.customImage === "string" ? f.customImage : null,
      color: f.color,
      size: resolveSymbolSize(f.size),
      position:
        pos && typeof pos === "object" && !Array.isArray(pos) &&
        typeof (pos as Record<string, unknown>).x === "number" &&
        typeof (pos as Record<string, unknown>).y === "number"
          ? { x: (pos as Record<string, unknown>).x as number, y: (pos as Record<string, unknown>).y as number }
          : null,
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function fmtFieldValue(value: unknown, fieldType: string): string {
  if (value === null || value === undefined) return ""
  if (fieldType === "boolean") return value ? "✓" : "✗"
  return String(value)
}

function slugify(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^\w_]/g, "")
}

function doExportCSV(events: ApiEvent[], fields: ApiFolderField[], folderName: string) {
  const baseHeaders = ["Title", "Start", "End", "Location", "Description", "Source"]
  const headers = [...baseHeaders, ...fields.map(f => f.name)]
  const rows = events.map(ev => {
    const fv = (ev.folderFieldValues as Record<string, unknown> | null) ?? {}
    return [
      ev.title,
      fmtDate(ev.startTime),
      fmtDate(ev.endTime),
      ev.location ?? "",
      ev.description ?? "",
      ev.source ?? "",
      ...fields.map(f => fmtFieldValue(fv[f.id], f.fieldType)),
    ]
  })
  const csv = [headers, ...rows]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${slugify(folderName)}-events.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function doExportXLSX(events: ApiEvent[], fields: ApiFolderField[], folderName: string) {
  const data = events.map(ev => {
    const fv = (ev.folderFieldValues as Record<string, unknown> | null) ?? {}
    const row: Record<string, string> = {
      Title: ev.title,
      Start: fmtDate(ev.startTime),
      End: fmtDate(ev.endTime),
      Location: ev.location ?? "",
      Description: ev.description ?? "",
      Source: ev.source ?? "",
    }
    fields.forEach(f => { row[f.name] = fmtFieldValue(fv[f.id], f.fieldType) })
    return row
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Events")
  XLSX.writeFile(wb, `${slugify(folderName)}-events.xlsx`)
}

// ── FolderCard ────────────────────────────────────────────────────────────────

function FolderCard({
  folder,
  onEdit,
  onDelete,
  onOpen,
}: {
  folder: FolderWithCount
  onEdit: () => void
  onDelete: () => void
  onOpen: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const count = folder._count?.events ?? 0
  const { fillColor, folderSymbol } = parseFolderMeta(folder.visualStyle)
  const iconSize = resolveSymbolSize(folderSymbol?.size)
  const SymIcon = folderSymbol?.icon ? SYMBOL_ICONS[folderSymbol.icon as SymbolIconName] : null

  return (
    <div
      onClick={onOpen}
      className={`relative flex flex-col gap-3 p-4 border border-smoke-700 hover:border-smoke-500 rounded-xl transition-colors cursor-pointer ${!fillColor ? "bg-smoke-800/50" : ""}`}
      style={{ backgroundColor: fillColor ? `${fillColor}33` : undefined }}
    >
      {/* Folder symbol — top-right corner */}
      {folderSymbol && (
        <div className="absolute top-2 right-2 pointer-events-none" style={{ lineHeight: 0 }}>
          {folderSymbol.customImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={folderSymbol.customImage} alt="" style={{ width: iconSize, height: iconSize, objectFit: "contain" }} />
          ) : SymIcon ? (
            <SymIcon size={iconSize} color={folderSymbol.color} />
          ) : null}
        </div>
      )}

      {/* Name */}
      <div className="flex items-center gap-2.5 min-w-0">
        {folder.icon && (
          <span className="text-base leading-none shrink-0">{folder.icon}</span>
        )}
        <span className="text-sm font-medium text-smoke-100 truncate">{folder.name}</span>
      </div>

      <span className="text-[10px] text-smoke-600">
        {count} {count === 1 ? "event" : "events"}
      </span>

      {/* Actions — stop propagation so card click doesn't open detail */}
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-smoke-400">Delete?</span>
            <button
              onClick={onDelete}
              className="text-[10px] text-doom-ember hover:text-doom-ember/70 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="text-[10px] text-smoke-500 hover:text-smoke-200 border border-smoke-700 hover:border-smoke-500 rounded px-2 py-0.5 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[10px] text-smoke-500 hover:text-doom-ember border border-smoke-700 hover:border-doom-ember/40 rounded px-2 py-0.5 transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── SortableHeader ────────────────────────────────────────────────────────────

function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: "asc" | "desc"
  onSort: (k: SortKey) => void
}) {
  const active = currentKey === sortKey
  return (
    <th
      className="px-3 py-2 text-left text-[10px] text-smoke-400 uppercase tracking-wider cursor-pointer hover:text-smoke-200 select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? (currentDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : <span className="inline-block w-[10px]" />
        }
      </span>
    </th>
  )
}

// ── FolderManager ─────────────────────────────────────────────────────────────

export default function FolderManager() {
  const queryClient = useQueryClient()

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [editingFolder, setEditingFolder] = useState<FolderWithCount | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("startTime")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [eventEditorOpen, setEventEditorOpen] = useState(false)
  const [eventToEditInFolder, setEventToEditInFolder] = useState<ApiEvent | null>(null)
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<string | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: folders = [], isLoading: foldersLoading } = useQuery<FolderWithCount[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      return res.json() as Promise<FolderWithCount[]>
    },
  })

  const selectedFolder = folders.find(f => f.id === selectedFolderId) ?? null

  const { data: events = [], isLoading: eventsLoading } = useQuery<ApiEvent[]>({
    queryKey: ["events", "folder", selectedFolderId],
    enabled: !!selectedFolderId,
    queryFn: async () => {
      const res = await fetch(`/api/events?folderId=${selectedFolderId}`)
      return res.json() as Promise<ApiEvent[]>
    },
  })

  const { data: folderFields = [] } = useQuery<ApiFolderField[]>({
    queryKey: ["folder-fields", selectedFolderId],
    enabled: !!selectedFolderId,
    queryFn: async () => {
      const res = await fetch(`/api/folder-fields?folderId=${selectedFolderId}`)
      return res.json() as Promise<ApiFolderField[]>
    },
  })

  // ── Sort ─────────────────────────────────────────────────────────────────────

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const cmp = sortKey === "title"
        ? a.title.localeCompare(b.title)
        : new Date(a[sortKey]).getTime() - new Date(b[sortKey]).getTime()
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [events, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function deleteFolder(id: string) {
    await fetch(`/api/folders/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["folders"] })
  }

  function openEventCreate() {
    setEventToEditInFolder(null)
    setEventEditorOpen(true)
  }

  function openEventEdit(ev: ApiEvent) {
    setEventToEditInFolder(ev)
    setEventEditorOpen(true)
  }

  function closeEventEditor() {
    setEventEditorOpen(false)
    setEventToEditInFolder(null)
  }

  async function onEventSaved() {
    await queryClient.invalidateQueries({ queryKey: ["events", "folder", selectedFolderId] })
    closeEventEditor()
  }

  async function onEventDeleted(id: string) {
    await fetch(`/api/events/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["events", "folder", selectedFolderId] })
    closeEventEditor()
  }

  async function deleteEventRow(id: string) {
    await fetch(`/api/events/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["events", "folder", selectedFolderId] })
    setConfirmDeleteEventId(null)
  }

  // ── Detail view ───────────────────────────────────────────────────────────────

  if (selectedFolder) {
    return (
      <div className="h-full flex flex-col bg-navy-950 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-smoke-700 shrink-0">
          <button
            onClick={() => setSelectedFolderId(null)}
            className="flex items-center gap-1 text-xs text-smoke-400 hover:text-smoke-200 transition-colors shrink-0"
          >
            <ChevronLeft size={13} />
            Folders
          </button>
          <span className="text-smoke-700 text-xs">·</span>
          {(() => { const { fillColor } = parseFolderMeta(selectedFolder.visualStyle); return fillColor ? <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fillColor }} /> : null })()}
          {selectedFolder.icon && <span className="text-base leading-none">{selectedFolder.icon}</span>}
          <h1 className="text-sm font-semibold text-smoke-200 truncate">{selectedFolder.name}</h1>
          <span className="text-[10px] text-smoke-600 ml-auto shrink-0">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
          <button
            onClick={openEventCreate}
            className="ml-3 px-2.5 py-1 text-[10px] font-medium text-doom-gold bg-doom-gold/10 border border-doom-gold/30 hover:bg-doom-gold/20 hover:border-doom-gold/50 rounded-lg transition-colors shrink-0"
          >
            + Add Event
          </button>
        </div>

        {/* Events table */}
        <div className="flex-1 overflow-auto">
          {eventsLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-xs text-smoke-500">Loading…</span>
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-xs text-smoke-600 italic">No events in this folder.</span>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-navy-950 border-b border-smoke-700 z-10">
                <tr>
                  <SortableHeader label="Title" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Start" sortKey="startTime" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="End" sortKey="endTime" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2 text-left text-[10px] text-smoke-400 uppercase tracking-wider whitespace-nowrap">Location</th>
                  <th className="px-3 py-2 text-left text-[10px] text-smoke-400 uppercase tracking-wider whitespace-nowrap">Notes</th>
                  {folderFields.map(f => (
                    <th key={f.id} className="px-3 py-2 text-left text-[10px] text-smoke-400 uppercase tracking-wider whitespace-nowrap">
                      {f.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-[10px] text-smoke-400 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((ev, i) => {
                  const fv = (ev.folderFieldValues as Record<string, unknown> | null) ?? {}
                  return (
                    <tr
                      key={ev.id}
                      className={`border-b border-smoke-800/50 hover:bg-navy-900/30 transition-colors ${
                        i % 2 !== 0 ? "bg-smoke-900/20" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-xs font-medium text-smoke-200 max-w-xs truncate">{ev.title}</td>
                      <td className="px-3 py-2 text-xs text-smoke-400 whitespace-nowrap">{fmtDate(ev.startTime)}</td>
                      <td className="px-3 py-2 text-xs text-smoke-400 whitespace-nowrap">{fmtDate(ev.endTime)}</td>
                      <td className="px-3 py-2 text-xs text-smoke-500 max-w-[8rem] truncate">{ev.location ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-smoke-500 max-w-[10rem] truncate">{ev.description ?? "—"}</td>
                      {folderFields.map(f => (
                        <td key={f.id} className="px-3 py-2 text-xs text-smoke-400">
                          {fmtFieldValue(fv[f.id], f.fieldType) || "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {confirmDeleteEventId === ev.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-[10px] text-smoke-400">Delete?</span>
                            <button
                              onClick={() => void deleteEventRow(ev.id)}
                              className="text-[10px] text-doom-ember hover:text-doom-ember/70 transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteEventId(null)}
                              className="text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openEventEdit(ev)}
                              className="text-[10px] text-smoke-500 hover:text-smoke-200 border border-smoke-700 hover:border-smoke-500 rounded px-1.5 py-0.5 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setConfirmDeleteEventId(ev.id)}
                              className="text-[10px] text-smoke-500 hover:text-doom-ember border border-smoke-700 hover:border-doom-ember/40 rounded px-1.5 py-0.5 transition-colors"
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Export footer */}
        {events.length > 0 && (
          <div className="flex items-center gap-3 px-6 py-3 border-t border-smoke-700 shrink-0">
            <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Export</span>
            <button
              onClick={() => doExportCSV(sortedEvents, folderFields, selectedFolder.name)}
              className="px-3 py-1.5 text-xs border border-smoke-700 text-smoke-400 hover:text-smoke-200 hover:border-smoke-500 rounded transition-colors"
            >
              CSV
            </button>
            <button
              onClick={() => doExportXLSX(sortedEvents, folderFields, selectedFolder.name)}
              className="px-3 py-1.5 text-xs border border-smoke-700 text-smoke-400 hover:text-smoke-200 hover:border-smoke-500 rounded transition-colors"
            >
              XLSX
            </button>
          </div>
        )}

        {/* Event editor */}
        {eventEditorOpen && (
          <EventForm
            date={new Date()}
            startHour={9}
            eventToEdit={eventToEditInFolder}
            prefillFolderId={eventToEditInFolder ? undefined : selectedFolder.id}
            onSave={onEventSaved}
            onDelete={onEventDeleted}
            onClose={closeEventEditor}
          />
        )}
      </div>
    )
  }

  // ── Folder list view ──────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-navy-950 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-smoke-700 shrink-0">
        <h1 className="text-sm font-semibold text-smoke-300 uppercase tracking-widest">Folders</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-3 py-1.5 text-xs font-medium text-doom-gold bg-doom-gold/10 border border-doom-gold/30 hover:bg-doom-gold/20 hover:border-doom-gold/50 rounded-lg transition-colors"
        >
          + New Folder
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 p-6">
        {foldersLoading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-xs text-smoke-500">Loading…</span>
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-3">
            <p className="text-xs text-smoke-600 italic">No folders yet.</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="text-xs text-doom-gold hover:text-doom-gold/80 transition-colors"
            >
              Create your first folder →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {folders.map(folder => (
              <FolderCard
                key={folder.id}
                folder={folder}
                onEdit={() => setEditingFolder(folder)}
                onDelete={() => void deleteFolder(folder.id)}
                onOpen={() => setSelectedFolderId(folder.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {createOpen && (
        <FolderSetup onClose={() => { setCreateOpen(false) }} />
      )}
      {editingFolder && (
        <FolderSetup folderToEdit={editingFolder} onClose={() => setEditingFolder(null)} />
      )}
    </div>
  )
}
