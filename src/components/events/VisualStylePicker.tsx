"use client"

import { useState, useEffect } from "react"
import type { VisualStyle } from "@/types"

// ─── Managed colour presets (localStorage) ────────────────────────────────────

const LS_COLOR_KEY = "plandoom_color_presets"
const MAX_COLOR_PRESETS = 20

// Combined, deduplicated defaults drawn from all four original preset arrays
const DEFAULT_COLORS: string[] = [
  "#162d5e", "#0f2044", "#1e3a78", "#2a4d96",
  "#4a2d6b", "#23262a", "#2e3236", "#484e55",
  "#3d1a12", "#8b3a2a",
  "#3d2e0e", "#c9a84c", "#d4b483",
  "#9ca3af", "#d1d5db", "#f3f4f6", "#ffffff",
]

type ColorPreset = { id: string; color: string }

function makeDefaults(): ColorPreset[] {
  return DEFAULT_COLORS.map((color, i) => ({ id: `d${i}`, color }))
}

function loadPresets(): ColorPreset[] | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_COLOR_KEY) : null
    if (raw === null) return null
    return JSON.parse(raw) as ColorPreset[]
  } catch {
    return null
  }
}

function persistPresets(presets: ColorPreset[]) {
  localStorage.setItem(LS_COLOR_KEY, JSON.stringify(presets))
}

// ─── Shape / Font constants ───────────────────────────────────────────────────

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

// ─── ColorInput ───────────────────────────────────────────────────────────────

interface ColorInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  allowTransparent?: boolean
  onActive?: () => void
}

function ColorInput({ label, value, onChange, allowTransparent, onActive }: ColorInputProps) {
  const isTransparent = value === "transparent"

  function handle(v: string) {
    onActive?.()
    onChange(v)
  }

  function handleHex(raw: string) {
    const v = raw.startsWith("#") ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) handle(v)
  }

  return (
    <div>
      <p className="text-[10px] text-smoke-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {allowTransparent && (
          <button
            type="button"
            title="None / transparent"
            onClick={() => handle("transparent")}
            className="w-5 h-5 rounded-sm shrink-0 border overflow-hidden transition-all"
            style={{
              backgroundImage: "linear-gradient(135deg,#444 40%,transparent 40%,transparent 60%,#444 60%)",
              backgroundSize: "6px 6px",
              borderColor: isTransparent ? "#c9a84c" : "#3a3f45",
              outlineOffset: "1px",
            }}
          />
        )}
        <div className="relative w-5 h-5 shrink-0">
          <div
            className="w-5 h-5 rounded-sm border"
            style={{
              backgroundColor: isTransparent ? "#23262a" : value,
              borderColor: "#484e55",
            }}
          />
          <input
            type="color"
            value={isTransparent ? "#000000" : (value.length === 7 ? value : "#000000")}
            onChange={(e) => handle(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Open colour picker"
          />
        </div>
        <input
          type="text"
          value={isTransparent ? "" : value}
          onChange={(e) => handleHex(e.target.value)}
          onFocus={onActive}
          placeholder="#000000"
          maxLength={7}
          className="w-20 bg-smoke-800 border border-smoke-600 rounded px-1.5 py-0.5 text-[10px] text-smoke-100 font-mono focus:outline-none focus:border-doom-gold"
        />
      </div>
    </div>
  )
}

// ─── WidthPicker ──────────────────────────────────────────────────────────────

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

// ─── ColourPresetsPanel ───────────────────────────────────────────────────────

function ColourPresetsPanel({
  presets,
  activeColor,
  onApply,
  onDelete,
  onAdd,
  onReset,
}: {
  presets: ColorPreset[]
  activeColor: string
  onApply: (color: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onReset: () => void
}) {
  const canAdd = activeColor !== "transparent" && presets.length < MAX_COLOR_PRESETS

  return (
    <div className="pt-3 border-t border-smoke-700/60">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-smoke-400 uppercase tracking-wider">Colour presets</p>
        <span className="text-[9px] text-smoke-600 tabular-nums">{presets.length}/{MAX_COLOR_PRESETS}</span>
      </div>

      {presets.length === 0 ? (
        <button
          type="button"
          onClick={onReset}
          className="w-full px-2 py-1.5 text-[10px] text-smoke-400 border border-smoke-700 rounded hover:border-doom-gold hover:text-doom-gold transition-colors"
        >
          Reset default colours
        </button>
      ) : (
        <div className="flex flex-wrap gap-1.5 items-center">
          {presets.map((p) => (
            <div key={p.id} className="relative group shrink-0">
              <button
                type="button"
                title={p.color}
                onClick={() => onApply(p.color)}
                className="w-5 h-5 rounded-sm border border-smoke-600 block transition-transform hover:scale-110 hover:border-smoke-400"
                style={{ backgroundColor: p.color }}
              />
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-doom-ember text-white text-[8px] leading-none items-center justify-center hidden group-hover:flex"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
          {/* Add current active colour */}
          {canAdd && (
            <button
              type="button"
              onClick={onAdd}
              title={`Add ${activeColor} to presets`}
              className="w-5 h-5 rounded-sm border border-smoke-600 border-dashed text-smoke-500 hover:border-doom-gold hover:text-doom-gold text-[11px] leading-none flex items-center justify-center transition-colors shrink-0 font-bold"
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── VisualStylePicker ────────────────────────────────────────────────────────

type ActiveField = "fillColor" | "frameColor" | "sideColor" | "textColor"

interface Props {
  value: VisualStyle
  onChange: (v: VisualStyle) => void
}

export default function VisualStylePicker({ value, onChange }: Props) {
  const [activeField, setActiveField] = useState<ActiveField>("fillColor")
  const [presets, setPresets] = useState<ColorPreset[]>([])
  const [presetsReady, setPresetsReady] = useState(false)

  useEffect(() => {
    const stored = loadPresets()
    setPresets(stored ?? makeDefaults())
    setPresetsReady(true)
  }, [])

  function set<K extends keyof VisualStyle>(key: K, val: VisualStyle[K]) {
    onChange({ ...value, [key]: val })
  }

  function updatePresets(next: ColorPreset[]) {
    setPresets(next)
    persistPresets(next)
  }

  function addPreset() {
    const color = value[activeField] as string
    if (!color || color === "transparent" || presets.length >= MAX_COLOR_PRESETS) return
    updatePresets([...presets, { id: Date.now().toString(), color }])
  }

  function deletePreset(id: string) {
    updatePresets(presets.filter((p) => p.id !== id))
  }

  function applyPreset(color: string) {
    onChange({ ...value, [activeField]: color })
  }

  function resetPresets() {
    updatePresets(makeDefaults())
  }

  const activeColor = value[activeField] as string

  return (
    <div className="flex flex-col gap-4">
      {/* Colour presets — unified managed list */}
      {presetsReady && (
        <ColourPresetsPanel
          presets={presets}
          activeColor={activeColor}
          onApply={applyPreset}
          onDelete={deletePreset}
          onAdd={addPreset}
          onReset={resetPresets}
        />
      )}

      {/* Fill */}
      <ColorInput
        label="Fill"
        value={value.fillColor}
        onChange={(v) => set("fillColor", v)}
        onActive={() => setActiveField("fillColor")}
      />

      {/* Frame */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <ColorInput
            label="Frame"
            value={value.frameColor}
            onChange={(v) => set("frameColor", v)}
            allowTransparent
            onActive={() => setActiveField("frameColor")}
          />
        </div>
        <WidthPicker label="Width" value={value.frameWidth} onChange={(v) => set("frameWidth", v)} min={0} max={4} />
      </div>

      {/* Side */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <ColorInput
            label="Side"
            value={value.sideColor}
            onChange={(v) => set("sideColor", v)}
            allowTransparent
            onActive={() => setActiveField("sideColor")}
          />
        </div>
        <WidthPicker label="Width" value={value.sideWidth} onChange={(v) => set("sideWidth", v)} min={0} max={4} />
      </div>

      {/* Text colour */}
      <ColorInput
        label="Text colour"
        value={value.textColor}
        onChange={(v) => set("textColor", v)}
        onActive={() => setActiveField("textColor")}
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
