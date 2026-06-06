"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { SEENDO_DAILY_LIMIT, SEENDO_RESTRICTED_THRESHOLD, SEENDO_WINDOW_MS } from "@/lib/seendo-limits"
import { pathToPoints, smoothedPath } from "@/lib/shapeUtils"
import PolygonEditor from "@/components/events/EventForm/tabs/PolygonEditor"

// ── System presets ────────────────────────────────────────────────────────────

type Point = { x: number; y: number }

function pointsToPath(points: Point[]): string {
  if (points.length < 3) return ""
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(5)} ${p.y.toFixed(5)}`).join(" ") + " Z"
}

const SYSTEM_PRESETS: { name: string; pts: Point[] }[] = [
  {
    name: "Rectangle",
    pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
  },
  {
    name: "Rounded",
    pts: [
      { x: 0.05, y: 0 }, { x: 0.95, y: 0 },
      { x: 1, y: 0.08 }, { x: 1, y: 0.92 },
      { x: 0.95, y: 1 }, { x: 0.05, y: 1 },
      { x: 0, y: 0.92 }, { x: 0, y: 0.08 },
    ],
  },
  {
    name: "Pill",
    pts: [
      { x: 0.25, y: 0 }, { x: 0.75, y: 0 },
      { x: 0.93, y: 0.15 }, { x: 1, y: 0.5 }, { x: 0.93, y: 0.85 },
      { x: 0.75, y: 1 }, { x: 0.25, y: 1 },
      { x: 0.07, y: 0.85 }, { x: 0, y: 0.5 }, { x: 0.07, y: 0.15 },
    ],
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type GlobalPreset = {
  id: string
  name: string
  visualStyle: {
    path: string
    smoothing?: number
    fillColor?: string
    frameColor?: string
  }
  createdAt: string
}

type FormState = {
  name: string
  path: string | null
  smoothing: number
  fillColor: string
  frameColor: string
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

function makeInitialForm(preset?: GlobalPreset): FormState {
  return {
    name: preset?.name ?? "",
    path: preset?.visualStyle.path ?? null,
    smoothing: preset?.visualStyle.smoothing ?? 0,
    fillColor: preset?.visualStyle.fillColor ?? "rgba(22,45,94,0.9)",
    frameColor: preset?.visualStyle.frameColor ?? "#c9a84c",
  }
}

function ShapePresetForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: GlobalPreset
  onSave: (data: { name: string; visualStyle: { path: string; smoothing: number; fillColor: string; frameColor: string } }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>(() => makeInitialForm(initial))
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null)
  const [widthPercent, setWidthPercent] = useState(100)
  const [leftOffset, setLeftOffset] = useState(0)

  function patch(updates: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  function handleSave() {
    if (!form.name.trim() || !form.path) return
    onSave({
      name: form.name.trim(),
      visualStyle: {
        path: form.path,
        smoothing: form.smoothing,
        fillColor: form.fillColor,
        frameColor: form.frameColor,
      },
    })
  }

  const canSave = !!form.name.trim() && !!form.path

  return (
    <div className="flex flex-col gap-4 p-3 border border-smoke-700 rounded-lg bg-navy-900/60">
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

      <div className="border border-smoke-700 rounded-lg p-2 bg-navy-950/40">
        <PolygonEditor
          shapePath={form.path}
          onChange={(p) => patch({ path: p })}
          canvasHeight={200}
          smoothing={form.smoothing}
          onSmoothing={(v) => patch({ smoothing: v })}
          textPosition={textPosition}
          onTextPosition={setTextPosition}
          widthPercent={widthPercent}
          onWidthPercent={setWidthPercent}
          leftOffset={leftOffset}
          onLeftOffset={setLeftOffset}
          hidePresets
        />
      </div>

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
          disabled={!canSave || saving}
          className="px-3 py-1.5 text-xs bg-navy-700 hover:bg-navy-600 text-smoke-100 rounded disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
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
  preset: GlobalPreset
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        isEditing
          ? "border-doom-gold/40 bg-navy-800/40"
          : "border-smoke-700 bg-smoke-900/30 hover:border-smoke-600"
      }`}
    >
      <ShapeThumbnail
        path={preset.visualStyle.path}
        smoothing={preset.visualStyle.smoothing}
        fillColor={preset.visualStyle.fillColor}
        frameColor={preset.visualStyle.frameColor}
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
              onClick={() => setConfirmDelete(true)}
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

// ── AdminShapePresets ─────────────────────────────────────────────────────────

function AdminShapePresets() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: presets = [], isLoading } = useQuery<GlobalPreset[]>({
    queryKey: ["admin-shape-presets"],
    queryFn: async () => {
      const r = await fetch("/api/admin/shape-presets")
      if (!r.ok) throw new Error("fetch failed")
      return r.json()
    },
  })

  async function handleSave(
    id: string | "new",
    data: { name: string; visualStyle: { path: string; smoothing: number; fillColor: string; frameColor: string } }
  ) {
    setSaving(true)
    try {
      if (id === "new") {
        await fetch("/api/admin/shape-presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
      } else {
        await fetch(`/api/admin/shape-presets/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-shape-presets"] })
      await queryClient.invalidateQueries({ queryKey: ["shape-presets-global"] })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/shape-presets/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["admin-shape-presets"] })
    await queryClient.invalidateQueries({ queryKey: ["shape-presets-global"] })
    if (editingId === id) setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* System presets — hardcoded, read-only, visualizzazione informativa */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-smoke-500 uppercase tracking-wider">System Presets</p>
        {SYSTEM_PRESETS.map((sp) => {
          const path = pointsToPath(sp.pts)
          return (
            <div
              key={sp.name}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-smoke-800/60 bg-navy-950/20"
            >
              <ShapeThumbnail path={path} smoothing={0} />
              <span className="flex-1 text-xs text-smoke-400 truncate">{sp.name}</span>
              <span className="text-[10px] text-smoke-700 shrink-0">system</span>
            </div>
          )
        })}
      </div>

      <hr className="border-smoke-800" />

      <div>
        <h3 className="text-sm font-semibold text-smoke-100">Global Shape Presets</h3>
        <p className="text-[10px] text-smoke-500 mt-0.5">
          Visible to all users as read-only presets in their Shape Presets section
        </p>
      </div>

      {isLoading && <p className="text-xs text-smoke-500">Loading…</p>}

      {!isLoading && presets.length === 0 && editingId !== "new" && (
        <p className="text-xs text-smoke-500 py-4 text-center">No global shape presets yet.</p>
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
                saving={saving}
              />
            )}
          </div>
        ))}

        {editingId === "new" && (
          <ShapePresetForm
            key="new"
            onSave={(data) => handleSave("new", data)}
            onCancel={() => setEditingId(null)}
            saving={saving}
          />
        )}
      </div>

      {editingId !== "new" && (
        <button
          onClick={() => setEditingId("new")}
          className="flex items-center gap-1.5 self-start px-3 py-1.5 text-xs text-smoke-400 hover:text-smoke-200 border border-dashed border-smoke-700 hover:border-smoke-500 rounded transition-colors mt-1"
        >
          + New Global Shape Preset
        </button>
      )}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: string
  seendoTokensUsed: number
  seendoTokensResetAt: string | null
  seendoStorageBytes: number
  _count: { events: number; chips: number; folders: number; palettes: number }
}

type SortKey = "name" | "email" | "role" | "createdAt" | "events" | "chips" | "folders" | "palettes" | "storage" | "seendoTokens"
type SortDir = "asc" | "desc"

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

// ── AdminUsers ────────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={10} className="text-smoke-600 ml-1 inline" />
  return sortDir === "asc"
    ? <ChevronUp size={10} className="text-doom-gold ml-1 inline" />
    : <ChevronDown size={10} className="text-doom-gold ml-1 inline" />
}

function AdminUsers() {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users")
      if (!r.ok) throw new Error("fetch failed")
      return r.json()
    },
    staleTime: 60_000,
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = [...users].sort((a, b) => {
    let av: string | number
    let bv: string | number
    if (sortKey === "storage") {
      av = a.seendoStorageBytes
      bv = b.seendoStorageBytes
    } else if (sortKey === "seendoTokens") {
      av = a.seendoTokensUsed
      bv = b.seendoTokensUsed
    } else if (sortKey === "events" || sortKey === "chips" || sortKey === "folders" || sortKey === "palettes") {
      av = a._count[sortKey]
      bv = b._count[sortKey]
    } else if (sortKey === "name") {
      av = a.name ?? ""
      bv = b.name ?? ""
    } else {
      av = a[sortKey] ?? ""
      bv = b[sortKey] ?? ""
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1
    if (av > bv) return sortDir === "asc" ? 1 : -1
    return 0
  })

  const cols: { key: SortKey; label: string; align?: "right" }[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "createdAt", label: "Registered" },
    { key: "events", label: "Events", align: "right" },
    { key: "chips", label: "Chips", align: "right" },
    { key: "folders", label: "Folders", align: "right" },
    { key: "palettes", label: "Palettes", align: "right" },
    { key: "storage", label: "Storage", align: "right" },
    { key: "seendoTokens", label: "Seendo", align: "right" },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-smoke-100">Users</h3>
        <p className="text-[10px] text-smoke-500 mt-0.5">{users.length} registered</p>
      </div>

      {isLoading && <p className="text-xs text-smoke-500">Loading…</p>}

      {!isLoading && (
        <div className="border border-smoke-700 rounded-lg overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-smoke-700 bg-smoke-900/40">
                {cols.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`px-3 py-2 text-smoke-400 font-medium cursor-pointer select-none hover:text-smoke-200 transition-colors ${col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {col.label}
                    <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id} className="border-b border-smoke-800 last:border-0 hover:bg-smoke-900/20">
                  <td className="px-3 py-2 text-smoke-200">{u.name ?? <span className="text-smoke-600 italic">—</span>}</td>
                  <td className="px-3 py-2 text-smoke-400 font-mono text-[10px]">{u.email}</td>
                  <td className="px-3 py-2">
                    {u.role === "admin" ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-doom-gold/20 text-doom-gold border border-doom-gold/30">
                        admin
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-smoke-800 text-smoke-400 border border-smoke-700">
                        user
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-smoke-500 font-mono text-[10px]">
                    {new Date(u.createdAt).toLocaleDateString("it-IT")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-smoke-300">{u._count.events}</td>
                  <td className="px-3 py-2 text-right font-mono text-smoke-300">{u._count.chips}</td>
                  <td className="px-3 py-2 text-right font-mono text-smoke-300">{u._count.folders}</td>
                  <td className="px-3 py-2 text-right font-mono text-smoke-300">{u._count.palettes}</td>
                  <td className="px-3 py-2 text-right font-mono text-smoke-500">{formatBytes(u.seendoStorageBytes)}</td>
                  <td className="px-3 py-2">
                    <SeendoTokenCell used={u.seendoTokensUsed} resetAt={u.seendoTokensResetAt} />
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-smoke-600">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── SeendoTokenCell ───────────────────────────────────────────────────────────

function SeendoTokenCell({ used, resetAt }: { used: number; resetAt: string | null }) {
  const now = Date.now()
  const isActive = resetAt !== null && now - new Date(resetAt).getTime() <= SEENDO_WINDOW_MS
  const pct = Math.min(100, (used / SEENDO_DAILY_LIMIT) * 100)
  const barColor =
    used >= SEENDO_DAILY_LIMIT
      ? "bg-red-500"
      : used >= SEENDO_DAILY_LIMIT * SEENDO_RESTRICTED_THRESHOLD
      ? "bg-amber-400"
      : "bg-green-400"

  return (
    <div className="flex items-center justify-end gap-2 min-w-[80px]">
      <div className="w-14 h-1 rounded-full bg-smoke-800 overflow-hidden">
        <div className={`h-full rounded-full ${isActive ? barColor : "bg-smoke-700"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-[11px] w-12 text-right ${isActive ? "text-smoke-300" : "text-smoke-600"}`}>
        {used.toLocaleString()}
      </span>
    </div>
  )
}

// ── AdminSeendoStats ──────────────────────────────────────────────────────────

type SeendoStatsData = {
  daily: { tokensUsed: number; tokensLimit: number; activeUsers: number }
  monthly: { tokensUsed: number; tokensLimit: number; monthYear: string }
  totalUsers: number
}

type TokenLogBucket = { hour: number; tokens: number; calls: number }
type TokenLogsData = { buckets: TokenLogBucket[] }

function SeendoBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-smoke-800 overflow-hidden">
      <div
        className="h-full rounded-full bg-doom-gold transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function AdminSeendoStats() {
  const { data, isLoading } = useQuery<SeendoStatsData>({
    queryKey: ["admin-seendo-stats"],
    queryFn: async () => {
      const r = await fetch("/api/admin/seendo-stats")
      if (!r.ok) throw new Error("fetch failed")
      return r.json() as Promise<SeendoStatsData>
    },
    staleTime: 60_000,
  })

  if (isLoading) return <p className="text-xs text-smoke-500">Loading…</p>
  if (!data) return null

  const dailyPct = data.daily.tokensLimit > 0
    ? ((data.daily.tokensUsed / data.daily.tokensLimit) * 100).toFixed(1)
    : "0"
  const monthlyPct = data.monthly.tokensLimit > 0
    ? ((data.monthly.tokensUsed / data.monthly.tokensLimit) * 100).toFixed(1)
    : "0"
  const [year, month] = data.monthly.monthYear.split("-")
  const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Giornaliera globale */}
      <div className="flex flex-col gap-2 p-3 rounded-lg border border-smoke-700 bg-navy-950/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Daily Global</span>
          <span className="text-[10px] font-mono text-smoke-400">
            {data.daily.tokensUsed.toLocaleString()} / {data.daily.tokensLimit.toLocaleString()}
          </span>
        </div>
        <SeendoBar used={data.daily.tokensUsed} limit={data.daily.tokensLimit} />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-smoke-600">{dailyPct}% used</span>
          <span className="text-[10px] text-smoke-600">{data.daily.activeUsers} active / {data.totalUsers} users</span>
        </div>
      </div>

      {/* Mensile globale */}
      <div className="flex flex-col gap-2 p-3 rounded-lg border border-smoke-700 bg-navy-950/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Monthly Global — {monthLabel}</span>
          <span className="text-[10px] font-mono text-smoke-400">
            {data.monthly.tokensUsed.toLocaleString()} / {data.monthly.tokensLimit.toLocaleString()}
          </span>
        </div>
        <SeendoBar used={data.monthly.tokensUsed} limit={data.monthly.tokensLimit} />
        <span className="text-[10px] text-smoke-600">{monthlyPct}% of monthly budget</span>
      </div>
    </div>
  )
}

// ── AdminTokenChart ───────────────────────────────────────────────────────────

function AdminTokenChart() {
  const { data, isLoading } = useQuery<TokenLogsData>({
    queryKey: ["admin-seendo-token-logs"],
    queryFn: async () => {
      const r = await fetch("/api/admin/seendo-token-logs")
      if (!r.ok) throw new Error("fetch failed")
      return r.json()
    },
    staleTime: 60_000,
  })

  if (isLoading) return <p className="text-xs text-smoke-500">Loading…</p>
  if (!data) return null

  const { buckets } = data
  const maxTokens = Math.max(...buckets.map((b) => b.tokens), 1)
  const totalTokens = buckets.reduce((s, b) => s + b.tokens, 0)
  const totalCalls = buckets.reduce((s, b) => s + b.calls, 0)

  const W = 240
  const H = 60
  const barW = W / 24
  const gap = 1.5

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-smoke-700 bg-navy-950/30">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Token Activity — Last 24h</span>
        <span className="text-[10px] font-mono text-smoke-500">
          {totalTokens.toLocaleString()} tokens · {totalCalls} calls
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 60 }}
        preserveAspectRatio="none"
      >
        {buckets.map((b, i) => {
          const barH = (b.tokens / maxTokens) * (H - 4)
          const x = i * barW + gap / 2
          const y = H - (barH || 2)
          return (
            <g key={i}>
              <rect x={x} y={4} width={barW - gap} height={H - 4} fill="#23262a" rx={0.5} />
              <rect
                x={x}
                y={y}
                width={barW - gap}
                height={b.tokens > 0 ? barH : 2}
                fill={b.tokens > 0 ? "#c9a84c" : "#3a3f45"}
                fillOpacity={b.tokens > 0 ? 0.9 : 0.4}
                rx={0.5}
              />
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between text-[9px] text-smoke-700 font-mono">
        <span>24h ago</span>
        <span>now</span>
      </div>
    </div>
  )
}

// ── AdminStorageStats ─────────────────────────────────────────────────────────

const R2_FREE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024  // 10 GB — free tier R2

function AdminStorageStats() {
  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users")
      if (!r.ok) throw new Error("fetch failed")
      return r.json()
    },
    staleTime: 60_000,
  })

  if (isLoading) return <p className="text-xs text-smoke-500">Loading…</p>

  const totalBytes = users.reduce((sum, u) => sum + u.seendoStorageBytes, 0)
  const pct = R2_FREE_LIMIT_BYTES > 0 ? Math.min(100, (totalBytes / R2_FREE_LIMIT_BYTES) * 100) : 0

  const topUsers = [...users]
    .filter((u) => u.seendoStorageBytes > 0)
    .sort((a, b) => b.seendoStorageBytes - a.seendoStorageBytes)

  return (
    <div className="flex flex-col gap-3">
      {/* Totale globale + progress bar */}
      <div className="flex flex-col gap-2 p-3 rounded-lg border border-smoke-700 bg-navy-950/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-smoke-500 uppercase tracking-wider">R2 Storage — Global</span>
          <span className="text-[10px] font-mono text-smoke-400">
            {formatBytes(totalBytes)} / 10 GB
          </span>
        </div>
        <SeendoBar used={totalBytes} limit={R2_FREE_LIMIT_BYTES} />
        <span className="text-[10px] text-smoke-600">{pct.toFixed(2)}% of free tier limit</span>
      </div>

      {/* Lista per utente — solo utenti con storage > 0, ordinati per consumo */}
      {topUsers.length > 0 ? (
        <div className="flex flex-col gap-1">
          {topUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 px-3 py-1.5 rounded border border-smoke-800/40 bg-smoke-900/20"
            >
              <span className="flex-1 text-xs text-smoke-300 truncate min-w-0">
                {u.name ?? u.email}
              </span>
              {u.name && (
                <span className="text-[10px] text-smoke-600 font-mono truncate max-w-[160px]">
                  {u.email}
                </span>
              )}
              <span className="text-[10px] font-mono text-smoke-400 shrink-0">
                {formatBytes(u.seendoStorageBytes)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-smoke-600 italic">No R2 storage consumed yet.</p>
      )}
    </div>
  )
}

// ── AdminTab ──────────────────────────────────────────────────────────────────

export default function AdminTab() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-base font-semibold text-smoke-100">Admin</h2>
        <p className="text-[10px] text-smoke-500 mt-0.5">Global configuration — visible only to admins</p>
      </div>

      <AdminShapePresets />
      <hr className="border-smoke-800" />
      <AdminUsers />
      <hr className="border-smoke-800" />
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-smoke-100">AI Usage</h3>
          <p className="text-[10px] text-smoke-500 mt-0.5">Seendo token consumption — daily window + monthly budget</p>
        </div>
        <AdminSeendoStats />
        <AdminTokenChart />
        <div className="mt-2">
          <h3 className="text-sm font-semibold text-smoke-100">Storage</h3>
          <p className="text-[10px] text-smoke-500 mt-0.5 mb-3">R2 file storage per user — OCR images + event attachments</p>
          <AdminStorageStats />
        </div>
      </div>
    </div>
  )
}
