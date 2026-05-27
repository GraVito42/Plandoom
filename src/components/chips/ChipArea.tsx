"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
    textColor: typeof r.textColor === "string" ? r.textColor : DEFAULT_CHIP_STYLE.textColor,
    fontFamily: typeof r.fontFamily === "string" ? r.fontFamily : DEFAULT_CHIP_STYLE.fontFamily,
    hasCheckbox: typeof r.hasCheckbox === "boolean" ? r.hasCheckbox : DEFAULT_CHIP_STYLE.hasCheckbox,
    isChecked: typeof r.isChecked === "boolean" ? r.isChecked : DEFAULT_CHIP_STYLE.isChecked,
    eventType: typeof r.eventType === "string" ? r.eventType : DEFAULT_CHIP_STYLE.eventType,
    shapePath: typeof r.shapePath === "string" ? r.shapePath : null,
    shapeSmoothing: typeof r.shapeSmoothing === "number" ? r.shapeSmoothing : 0,
    textPosition: tp && typeof tp.x === "number" && typeof tp.y === "number" ? tp : null,
    widthPercent: typeof r.widthPercent === "number" ? r.widthPercent : 100,
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
  // If chip has a non-default custom style, use it
  if (chipVS && !isDefaultStyle(chipVS)) return chipVS
  // Fall back to folder style if available
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

// ── Component ─────────────────────────────────────────────────────────────────

interface ChipAreaProps {
  area: ChipAreaType
  chips: ApiChip[]
  draggable?: boolean
  dayTarget?: string
  weekNumber?: number
  year?: number
  onSchedule?: (chip: ApiChip) => void
}

export default function ChipArea({
  area,
  chips,
  draggable = false,
  dayTarget,
  weekNumber,
  year,
  onSchedule,
}: ChipAreaProps) {
  const queryClient = useQueryClient()
  const [chipFormOpen, setChipFormOpen] = useState(false)
  const [editingChip, setEditingChip] = useState<ApiChip | null>(null)

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      return res.json() as Promise<ApiFolder[]>
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

  const layout = area === "daily" ? "horizontal" : "vertical"

  return (
    <div className="flex flex-col gap-1">
      {/* Chip list */}
      <div className={layout === "horizontal" ? "flex flex-row flex-wrap gap-1" : "flex flex-col gap-1"}>
        {chips.map((chip) => (
          <Chip
            key={chip.id}
            chip={chip}
            visualStyle={resolveStyle(chip, folders)}
            sizeUnits={chipSizeUnits(chip.duration)}
            layout={layout}
            draggable={draggable}
            onEdit={() => handleEdit(chip)}
            onSchedule={onSchedule}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <button
        onClick={() => setChipFormOpen(true)}
        className="self-start text-[10px] text-smoke-600 hover:text-smoke-400 transition-colors mt-0.5"
      >
        + Add chip
      </button>

      {/* Create form */}
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

      {/* Edit form */}
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
