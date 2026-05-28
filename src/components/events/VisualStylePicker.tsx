"use client"

import { useState, useEffect } from "react"
import type { VisualStyle } from "@/types"

// ─── Preset palettes ────────────────────────────────────────────────────────

const FILL_PRESETS = [
  "#0f2044", "#162d5e", "#1e3a78", "#2a4d96",
  "#4a2d6b", "#23262a", "#2e3236", "#3d1a12", "#3d2e0e",
]

const FRAME_PRESETS = [
  "#c9a84c", "#8b3a2a", "#4a2d6b", "#2a4d96",
  "#9ca3af", "#484e55", "#d1d5db",
]

const SIDE_PRESETS = [
  "#c9a84c", "#8b3a2a", "#4a2d6b", "#2a4d96",
  "#9ca3af", "#484e55",
]

const TEXT_PRESETS = [
  "#f3f4f6", "#d1d5db", "#9ca3af", "#c9a84c",
  "#8b3a2a", "#ffffff", "#d4b483",
]

const SHAPES: { label: string; value: VisualStyle["shape"] }[] = [
  { label: "Rect", value: "rectangle" },
  { label: "Round", value: "rounded" },
  { label: "Pill", value: "pill" },
]

const FONTS: { label: string; value: string }[] = [
  { label: "Default", value: "inherit" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
  { label: "Comic", value: "'Comic Sans MS', cursive" },
]

// ─── Color preset storage (localStorage) ─────────────────────────────────────

const LS_COLOR_KEY = "plandoom_color_presets"
const MAX_COLOR_PRESETS = 8

type ColorPreset = { id: string; color: string }

function loadColorPresets(): ColorPreset[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_COLOR_KEY) : null
    return raw ? (JSON.parse(raw) as ColorPreset[]) : []
  } catch {
    return []
  }
}

function persistColorPresets(presets: ColorPreset[]) {
  localStorage.setItem(LS_COLOR_KEY, JSON.stringify(presets))
}

// ─── ColorInput ─────────────────────────────────────────────────────────────

interface ColorInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  presets: string[]
  allowTransparent?: boolean
  onActive?: () => void
  onSaveColor?: () => void
}

function ColorInput({ label, value, onChange, presets, allowTransparent, onActive, onSaveColor }: ColorInputProps) {
  const isTransparent = value === "transparent"

  function handleHex(raw: string) {
    const v = raw.startsWith("#") ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
      onActive?.()
      onChange(v)
    }
  }

  function handleChange(v: string) {
    onActive?.()
    onChange(v)
  }

  return (
    <div>
      <p className="text-[10px] text-smoke-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => handleChange(c)}
            className="w-4 h-4 rounded-sm shrink-0 transition-all"
            style={{
              backgroundColor: c,
              outline: value === c ? "2px solid #c9a84c" : "2px solid transparent",
              outlineOffset: "1px",
            }}
          />
        ))}
        {allowTransparent && (
          <button
            type="button"
            title="None"
            onClick={() => handleChange("transparent")}
            className="w-4 h-4 rounded-sm shrink-0 border border-smoke-600 overflow-hidden transition-all"
            style={{
              backgroundImage: "linear-gradient(135deg,#444 40%,transparent 40%,transparent 60%,#444 60%)",
              backgroundSize: "6px 6px",
              outline: isTransparent ? "2px solid #c9a84c" : "2px solid transparent",
              outlineOffset: "1px",
            }}
          />
        )}
        {/* Save current color as preset */}
        {onSaveColor && !isTransparent && (
          <button
            type="button"
            onClick={() => { onActive?.(); onSaveColor() }}
            title="Save as color preset"
            className="w-4 h-4 rounded-sm shrink-0 border border-smoke-600 bg-smoke-700 text-smoke-400 hover:text-doom-gold hover:border-smoke-500 text-[9px] leading-none flex items-center justify-center transition-colors font-bold"
          >
            +
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative w-5 h-5 shrink-0">
          <div
            className="w-5 h-5 rounded-sm border border-smoke-500"
            style={{ backgroundColor: isTransparent ? "#23262a" : value }}
          />
          <input
            type="color"
            value={isTransparent ? "#000000" : (value.length === 7 ? value : "#000000")}
            onChange={(e) => handleChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Open color picker"
          />
        </div>
        <input
          type="text"
          value={isTransparent ? "" : value}
          onChange={(e) => handleHex(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          className="w-20 bg-smoke-800 border border-smoke-600 rounded px-1.5 py-0.5 text-[10px] text-smoke-100 font-mono focus:outline-none focus:border-doom-gold"
        />
      </div>
    </div>
  )
}

// ─── WidthPicker ─────────────────────────────────────────────────────────────

function WidthPicker({
  label,
  value,
  onChange,
  min = 0,
  max = 4,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div>
      <p className="text-[10px] text-smoke-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex gap-1">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            className={`px-2 py-0.5 text-[10px] rounded transition-all ${
              value === w
                ? "bg-doom-gold text-navy-950 font-medium"
                : "bg-smoke-700 text-smoke-300 hover:bg-smoke-600"
            }`}
          >
            {w === 0 ? "off" : `${w}px`}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── SavedColorPresets ────────────────────────────────────────────────────────

function SavedColorPresets({
  presets,
  onApply,
  onDelete,
}: {
  presets: ColorPreset[]
  onApply: (color: string) => void
  onDelete: (id: string) => void
}) {
  if (presets.length === 0) return null

  return (
    <div className="pt-3 border-t border-smoke-700/50">
      <p className="text-[10px] text-smoke-400 uppercase tracking-wider mb-1.5">Saved</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {presets.map((p) => (
          <div key={p.id} className="relative group shrink-0">
            <button
              type="button"
              title={p.color}
              onClick={() => onApply(p.color)}
              className="w-5 h-5 rounded-full border border-smoke-600 block transition-transform hover:scale-110"
              style={{ backgroundColor: p.color }}
            />
            <button
              type="button"
              onClick={() => onDelete(p.id)}
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-doom-ember text-white text-[7px] leading-none items-center justify-center hidden group-hover:flex"
              title="Remove preset"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── VisualStylePicker ────────────────────────────────────────────────────────

type ActiveColorField = "fillColor" | "frameColor" | "sideColor" | "textColor"

interface Props {
  value: VisualStyle
  onChange: (v: VisualStyle) => void
}

export default function VisualStylePicker({ value, onChange }: Props) {
  const [activeField, setActiveField] = useState<ActiveColorField>("fillColor")
  const [savedPresets, setSavedPresets] = useState<ColorPreset[]>([])

  useEffect(() => { setSavedPresets(loadColorPresets()) }, [])

  function set<K extends keyof VisualStyle>(key: K, val: VisualStyle[K]) {
    onChange({ ...value, [key]: val })
  }

  function addPreset(color: string) {
    if (!color || color === "transparent") return
    const updated = [...savedPresets, { id: Date.now().toString(), color }].slice(-MAX_COLOR_PRESETS)
    setSavedPresets(updated)
    persistColorPresets(updated)
  }

  function removePreset(id: string) {
    const updated = savedPresets.filter((p) => p.id !== id)
    setSavedPresets(updated)
    persistColorPresets(updated)
  }

  function applyPreset(color: string) {
    onChange({ ...value, [activeField]: color })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Fill */}
      <ColorInput
        label="Fill"
        value={value.fillColor}
        onChange={(v) => set("fillColor", v)}
        presets={FILL_PRESETS}
        onActive={() => setActiveField("fillColor")}
        onSaveColor={() => addPreset(value.fillColor)}
      />

      {/* Frame (cornice) */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <ColorInput
            label="Frame"
            value={value.frameColor}
            onChange={(v) => set("frameColor", v)}
            presets={FRAME_PRESETS}
            allowTransparent
            onActive={() => setActiveField("frameColor")}
            onSaveColor={() => addPreset(value.frameColor)}
          />
        </div>
        <WidthPicker
          label="Width"
          value={value.frameWidth}
          onChange={(v) => set("frameWidth", v)}
          min={0}
          max={4}
        />
      </div>

      {/* Side (lineetta laterale) */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <ColorInput
            label="Side"
            value={value.sideColor}
            onChange={(v) => set("sideColor", v)}
            presets={SIDE_PRESETS}
            allowTransparent
            onActive={() => setActiveField("sideColor")}
            onSaveColor={() => addPreset(value.sideColor)}
          />
        </div>
        <WidthPicker
          label="Width"
          value={value.sideWidth}
          onChange={(v) => set("sideWidth", v)}
          min={0}
          max={4}
        />
      </div>

      {/* Text color */}
      <ColorInput
        label="Text color"
        value={value.textColor}
        onChange={(v) => set("textColor", v)}
        presets={TEXT_PRESETS}
        onActive={() => setActiveField("textColor")}
        onSaveColor={() => addPreset(value.textColor)}
      />

      {/* Shape */}
      <div>
        <p className="text-[10px] text-smoke-400 uppercase tracking-wider mb-1.5">Shape</p>
        <div className="flex gap-1">
          {SHAPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => set("shape", s.value)}
              className={`px-2.5 py-0.5 text-xs rounded transition-all ${
                value.shape === s.value
                  ? "bg-doom-gold text-navy-950 font-medium"
                  : "bg-smoke-700 text-smoke-300 hover:bg-smoke-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font */}
      <div>
        <p className="text-[10px] text-smoke-400 uppercase tracking-wider mb-1.5">Font</p>
        <div className="flex gap-1 flex-wrap">
          {FONTS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => set("fontFamily", f.value)}
              className={`px-2.5 py-0.5 text-xs rounded transition-all ${
                value.fontFamily === f.value
                  ? "bg-doom-gold text-navy-950 font-medium"
                  : "bg-smoke-700 text-smoke-300 hover:bg-smoke-600"
              }`}
              style={{ fontFamily: f.value !== "inherit" ? f.value : undefined }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Checkbox */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value.hasCheckbox}
          onChange={(e) => set("hasCheckbox", e.target.checked)}
          className="accent-doom-gold"
        />
        <span className="text-xs text-smoke-300">Show checkbox</span>
      </label>

      {/* Saved color presets */}
      <SavedColorPresets
        presets={savedPresets}
        onApply={applyPreset}
        onDelete={removePreset}
      />
    </div>
  )
}
