"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useDroppable, useDndMonitor, type DragEndEvent } from "@dnd-kit/core"
import type { ApiChip, ApiFolder, ChipArea as ChipAreaType, VisualStyle } from "@/types"
import Chip from "./Chip"
import ChipForm from "./ChipForm"

// ── Style helpers ─────────────────────────────────────────────────────────────

const DEFAULT_CHIP_STYLE: VisualStyle = {
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

function parseVisualStyle(raw: unknown): VisualStyle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_CHIP_STYLE
  const r = raw as Record<string, unknown>
  const tp = r.textPosition as { x: number; y: number } | null | undefined
  return {
    shape: (["rectangle", "rounded", "pill"].includes(r.shape as string)
      ? r.shape : DEFAULT_CHIP_STYLE.shape) as VisualStyle["shape"],
    frameColor: typeof r.frameColor === "string" ? r.frameColor : DEFAULT_CHIP_STYLE.frameColor,
    frameWidth: typeof r.frameWidth === "number" ? r.frameWidth : DEFAULT_CHIP_STYLE.frameWidth,
    sideColor: typeof r.sideColor === "string" ? r.sideColor : DEFAULT_CHIP_STYLE.sideColor,
    sideWidth: typeof r.sideWidth === "number" ? r.sideWidth : DEFAULT_CHIP_STYLE.sideWidth,
    fillColor: typeof r.fillColor === "string" ? r.fillColor : DEFAULT_CHIP_STYLE.fillColor,
    fillOpacity: typeof r.fillOpacity === "number" ? r.fillOpacity : 100,
    textColor: typeof r.textColor === "string" ? r.textColor : DEFAULT_CHIP_STYLE.textColor,
    fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : DEFAULT_CHIP_STYLE.fontFamily,
    hasCheckbox: typeof r.hasCheckbox === "boolean" ? r.hasCheckbox : DEFAULT_CHIP_STYLE.hasCheckbox,
    isChecked: typeof r.isChecked === "boolean" ? r.isChecked : DEFAULT_CHIP_STYLE.isChecked,
    eventType: typeof r.eventType === "string" ? r.eventType : DEFAULT_CHIP_STYLE.eventType,
    shapePath: typeof r.shapePath === "string" ? r.shapePath : null,
    shapeSmoothing: typeof r.shapeSmoothing === "number" ? r.shapeSmoothing : 0,
    textPosition: tp && typeof tp.x === "number" && typeof tp.y === "number" ? tp : null,
    widthPercent: typeof r.widthPercent === "number" ? r.widthPercent : 100,
    leftOffset: typeof r.leftOffset === "number" ? r.leftOffset : 0,
  }
}

function isDefaultStyle(vs: VisualStyle): boolean {
  return (
    vs.fillColor === DEFAULT_CHIP_STYLE.fillColor &&
    vs.textColor === DEFAULT_CHIP_STYLE.textColor &&
    vs.frameColor === DEFAULT_CHIP_STYLE.frameColor &&
    vs.sideColor === DEFAULT_CHIP_STYLE.sideColor
  )
}

function resolveStyle(chip: ApiChip, folders: ApiFolder[]): VisualStyle {
  const chipVS = chip.visualStyle ? parseVisualStyle(chip.visualStyle) : null
  if (chipVS && !isDefaultStyle(chipVS)) return chipVS
  if (chip.folderId) {
    const folder = folders.find((f) => f.id === chip.folderId)
    if (folder?.visualStyle) return parseVisualStyle(folder.visualStyle)
  }
  return chipVS ?? DEFAULT_CHIP_STYLE
}

function chipSizeUnits(duration: number | null): number {
  if (!duration) return 1
  return Math.min(4, Math.max(1, Math.round(duration / 30)))
}

// Derive local YYYY-MM-DD string from a dayTarget ISO string
function toDateStr(dayTarget: string): string {
  const d = new Date(dayTarget)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ChipAreaProps {
  area: ChipAreaType
  chips: ApiChip[]
  draggable?: boolean
  dayTarget?: string
  weekNumber?: number
  year?: number
  onSchedule?: (chip: ApiChip) => void
  hideAddButton?: boolean
}

export default function ChipArea({
  area,
  chips,
  draggable = false,
  dayTarget,
  weekNumber,
  year,
  onSchedule,
  hideAddButton = false,
}: ChipAreaProps) {
  const queryClient = useQueryClient()
  const [chipFormOpen, setChipFormOpen] = useState(false)
  const [editingChip, setEditingChip] = useState<ApiChip | null>(null)

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      if (!res.ok) throw new Error("Failed to load folders")
      return res.json() as Promise<ApiFolder[]>
    },
  })

  const isDaily = area === "daily" && !!dayTarget
  const isWeekly = area === "weekly" && weekNumber != null && year != null
  const droppableId = isDaily
    ? `chip-daily-${toDateStr(dayTarget!)}`
    : isWeekly
      ? `chip-weekly-${year}-${weekNumber}`
      : `chip-noop-${area}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  useDndMonitor({
    async onDragEnd({ active, over }: DragEndEvent) {
      if (!over || over.id !== droppableId) return
      const data = active.data.current as { type: string; chipId?: string } | undefined
      if (data?.type !== "chip" || !data.chipId) return

      if (isDaily) {
        await fetch(`/api/chips/${data.chipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ area: "daily", dayTarget }),
        })
        await queryClient.invalidateQueries({ queryKey: ["chips"] })
      } else if (isWeekly) {
        await fetch(`/api/chips/${data.chipId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ area: "weekly", dayTarget: null, weekNumber, year }),
        })
        await queryClient.invalidateQueries({ queryKey: ["chips"] })
      }
    },
  })

  async function handleDelete(id: string) {
    await fetch(`/api/chips/${id}`, { method: "DELETE" })
    await queryClient.invalidateQueries({ queryKey: ["chips"] })
  }

  function handleEdit(chip: ApiChip) {
    setEditingChip(chip)
  }

  async function handleSave() {
    await queryClient.invalidateQueries({ queryKey: ["chips"] })
    setChipFormOpen(false)
    setEditingChip(null)
  }

  return (
    <div
      ref={(isDaily || isWeekly) ? setNodeRef : undefined}
      className={`flex flex-col gap-1 min-h-6 rounded transition-colors ${
        isOver ? "bg-doom-gold/10" : ""
      }`}
    >
      {/* BUG 3: always flex-col — daily chips stack vertically like all others */}
      <div className="flex flex-col gap-1">
        {chips.map((chip) => (
          <Chip
            key={chip.id}
            chip={chip}
            visualStyle={resolveStyle(chip, folders)}
            sizeUnits={chipSizeUnits(chip.duration)}
            layout="vertical"
            draggable={draggable}
            onEdit={() => handleEdit(chip)}
            onSchedule={onSchedule}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {!hideAddButton && (
        <button
          onClick={() => setChipFormOpen(true)}
          className="self-start text-[10px] text-smoke-600 hover:text-smoke-400 transition-colors mt-0.5"
        >
          + Add chip
        </button>
      )}

      {chipFormOpen && (
        <ChipForm
          area={area}
          dayTarget={dayTarget}
          weekNumber={weekNumber}
          year={year}
          onSave={handleSave}
          onClose={() => setChipFormOpen(false)}
        />
      )}

      {editingChip && (
        <ChipForm
          chipToEdit={editingChip}
          area={area}
          dayTarget={dayTarget}
          weekNumber={weekNumber}
          year={year}
          onSave={handleSave}
          onClose={() => setEditingChip(null)}
        />
      )}
    </div>
  )
}
