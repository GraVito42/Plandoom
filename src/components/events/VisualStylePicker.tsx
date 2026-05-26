"use client"

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

// ─── ColorInput ─────────────────────────────────────────────────────────────

interface ColorInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  presets: string[]
  allowTransparent?: boolean
}

function ColorInput({ label, value, onChange, presets, allowTransparent }: ColorInputProps) {
  const isTransparent = value === "transparent"

  function handleHex(raw: string) {
    const v = raw.startsWith("#") ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
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
            onClick={() => onChange(c)}
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
            onClick={() => onChange("transparent")}
            className="w-4 h-4 rounded-sm shrink-0 border border-smoke-600 overflow-hidden transition-all"
            style={{
              backgroundImage: "linear-gradient(135deg,#444 40%,transparent 40%,transparent 60%,#444 60%)",
              backgroundSize: "6px 6px",
              outline: isTransparent ? "2px solid #c9a84c" : "2px solid transparent",
              outlineOffset: "1px",
            }}
          />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {/* Native color wheel — overlaid on a small indicator square */}
        <div className="relative w-5 h-5 shrink-0">
          <div
            className="w-5 h-5 rounded-sm border border-smoke-500"
            style={{ backgroundColor: isTransparent ? "#23262a" : value }}
          />
          <input
            type="color"
            value={isTransparent ? "#000000" : (value.length === 7 ? value : "#000000")}
            onChange={(e) => onChange(e.target.value)}
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

// ─── VisualStylePicker ────────────────────────────────────────────────────────

interface Props {
  value: VisualStyle
  onChange: (v: VisualStyle) => void
}

export default function VisualStylePicker({ value, onChange }: Props) {
  function set<K extends keyof VisualStyle>(key: K, val: VisualStyle[K]) {
    onChange({ ...value, [key]: val })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Fill */}
      <ColorInput
        label="Fill"
        value={value.fillColor}
        onChange={(v) => set("fillColor", v)}
        presets={FILL_PRESETS}
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
    </div>
  )
}
