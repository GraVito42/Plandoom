"use client"

import { useState, useRef, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type React from "react"
import type { VisualStyle, ApiPalette } from "@/types"
import PolygonEditor from "./PolygonEditor"
import { PX_PER_HOUR } from "@/hooks/useGrid"
import { pathToPoints, smoothedPath } from "@/lib/shapeUtils"

const COLOR_PRESETS = [
  "#162d5e", "#0f2044", "#1e3a78", "#2a4d96",
  "#c9a84c", "#8b3a2a", "#4a2d6b", "#1a1c1e",
  "#d1d5db", "#6b7280", "transparent",
]

const FONTS = [
  { label: "Default", value: "inherit" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
  { label: "Comic", value: "'Comic Sans MS', cursive" },
]

// ── ColorInput ────────────────────────────────────────────────────────────────

function swatchBg(color: string): string {
  return color === "transparent"
    ? "repeating-conic-gradient(#555 0% 25%, #222 0% 50%) 0 0 / 8px 8px"
    : color
}

function ColorInput({
  value,
  onChange,
  label,
  personalPresets = [],
  onAddPreset,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  personalPresets?: Array<{ id: string; name: string; color: string }>
  onAddPreset?: (color: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value)
  const [presetFormOpen, setPresetFormOpen] = useState(false)
  const [presetName, setPresetName] = useState("")
  const pickerRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setHex(value) }, [value])

  function applyHex(v: string) {
    const clean = v.startsWith("#") ? v : `#${v}`
    setHex(clean)
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) onChange(clean)
  }

  function applyColor(v: string) {
    setHex(v)
    onChange(v)
    setOpen(false)
  }

  function submitPreset() {
    const name = presetName.trim()
    if (!name || !onAddPreset) return
    onAddPreset(value, name)
    setPresetFormOpen(false)
    setPresetName("")
  }

  const hexPreview = hex !== "transparent" && /^#[0-9a-fA-F]{3,6}$/.test(hex) ? hex : "#888888"

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-smoke-500 uppercase tracking-wider">{label}</span>
      <div className="relative">

        {/* Trigger — shows current color */}
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="w-full h-7 rounded border border-smoke-700 hover:border-smoke-500 transition-colors overflow-hidden"
          title={value}
        >
          <span
            className="block w-full h-full"
            style={{ background: swatchBg(value) }}
          >
            {value === "transparent" && (
              <span className="flex items-center justify-center h-full text-[10px] text-smoke-400">
                transparent
              </span>
            )}
          </span>
        </button>

        {open && (
          <div className="absolute left-0 top-9 z-50 bg-smoke-900 border border-smoke-700 rounded-lg shadow-2xl p-3 w-52">

            {/* Built-in preset swatches */}
            <div className="grid grid-cols-6 gap-1.5 mb-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => applyColor(c)}
                  title={c}
                  className="w-6 h-6 rounded hover:scale-110 transition-transform overflow-hidden shrink-0"
                  style={{
                    outline: value === c ? "2px solid #c9a84c" : "1px solid #3a3f45",
                    outlineOffset: value === c ? "2px" : "0px",
                  }}
                >
                  <span
                    className="block w-full h-full"
                    style={{ background: swatchBg(c) }}
                  />
                </button>
              ))}
            </div>

            {/* Personal presets */}
            {personalPresets.length > 0 && (
              <div className="border-t border-smoke-800 pt-2 mb-2">
                <div className="grid grid-cols-6 gap-1.5">
                  {personalPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyColor(p.color)}
                      title={p.name}
                      className="w-6 h-6 rounded hover:scale-110 transition-transform overflow-hidden shrink-0"
                      style={{
                        outline: value === p.color ? "2px solid #c9a84c" : "1px solid #3a3f45",
                        outlineOffset: value === p.color ? "2px" : "0px",
                      }}
                    >
                      <span className="block w-full h-full" style={{ background: swatchBg(p.color) }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom color row: picker + hex input */}
            <div className="flex gap-1.5 items-center mb-2">
              <div
                className="relative w-7 h-7 rounded border border-smoke-600 cursor-pointer shrink-0 overflow-hidden"
                onClick={() => pickerRef.current?.click()}
              >
                <span
                  className="absolute inset-0 rounded"
                  style={{ background: hexPreview }}
                />
                <input
                  ref={pickerRef}
                  type="color"
                  value={hexPreview}
                  onChange={(e) => applyHex(e.target.value)}
                  className="absolute opacity-0 w-full h-full cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={hex}
                onChange={(e) => applyHex(e.target.value)}
                maxLength={9}
                className="flex-1 bg-smoke-800 border border-smoke-700 text-smoke-200 text-xs px-2 py-1 rounded font-mono focus:outline-none focus:border-smoke-500"
                placeholder="#000000"
              />
            </div>

            {/* Save as preset */}
            {onAddPreset && !presetFormOpen && (
              <button
                type="button"
                onClick={() => setPresetFormOpen(true)}
                className="w-full text-left text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors border-t border-smoke-800 pt-2"
              >
                + Save as preset
              </button>
            )}
            {onAddPreset && presetFormOpen && (
              <div className="flex gap-1 items-center border-t border-smoke-800 pt-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitPreset()
                    if (e.key === "Escape") { setPresetFormOpen(false); setPresetName("") }
                  }}
                  placeholder="Preset name…"
                  autoFocus
                  className="flex-1 bg-smoke-800 border border-smoke-700 text-smoke-200 text-[10px] px-1.5 py-1 rounded focus:border-doom-gold/50 outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={submitPreset}
                  disabled={!presetName.trim()}
                  className="px-1.5 py-1 text-[10px] bg-doom-gold text-navy-950 rounded hover:bg-doom-gold/80 disabled:opacity-40 transition-colors shrink-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setPresetFormOpen(false); setPresetName("") }}
                  className="text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors shrink-0 px-1"
                >
                  ✕
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

function WidthSlider({
  value,
  onChange,
  label,
  max,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  max: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  function getValueFromX(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * max)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(getValueFromX(e.clientX))
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    onChange(getValueFromX(e.clientX))
  }

  const pct = max > 0 ? value / max : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-smoke-500 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-smoke-400 font-mono tabular-nums">
          {value === 0 ? "off" : `${value}px`}
        </span>
      </div>
      <div
        ref={trackRef}
        className="relative cursor-pointer select-none"
        style={{ height: 22 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      >
        {/* Track background */}
        <div className="absolute w-full rounded-full bg-smoke-700" style={{ height: 2, top: 16 }} />
        {/* Track fill */}
        <div
          className="absolute rounded-full bg-doom-gold/50"
          style={{ height: 2, top: 16, width: `${pct * 100}%` }}
        />
        {/* Triangle handle ▼ */}
        <svg
          className="absolute pointer-events-none"
          style={{ left: `calc(${pct * 100}% - 6px)`, top: 2 }}
          width={12}
          height={12}
        >
          <polygon points="6,0 12,11 0,11" fill="#c9a84c" opacity={0.9} />
        </svg>
      </div>
    </div>
  )
}

// ── EventPreview ─────────────────────────────────────────────────────────────

function EventPreview({ vs, previewH }: { vs: VisualStyle; previewH: number }) {
  const fw = vs.frameWidth > 0 && vs.frameColor !== "transparent" ? vs.frameWidth : 0
  const fc = fw > 0 ? vs.frameColor : "transparent"
  const hasFrame = fw > 0
  const hasSide = vs.sideWidth > 0 && vs.sideColor !== "transparent"
  const hasCustomShape = !!vs.shapePath
  const radius = hasCustomShape ? "0" : vs.shape === "pill" ? "99px" : vs.shape === "rounded" ? "4px" : "0"

  const pts = pathToPoints(vs.shapePath)
  const clipD = pts.length >= 3 ? smoothedPath(pts, vs.shapeSmoothing) : ""

  const widthPct = vs.widthPercent ?? 100
  const textPos = hasCustomShape ? vs.textPosition : null

  const blockStyle: React.CSSProperties = {
    position: "relative",
    height: previewH,
    width: `${widthPct}%`,
    backgroundColor: vs.fillColor === "transparent" ? "transparent" : vs.fillColor,
    borderRadius: radius,
    // CSS border only for standard shapes
    ...(hasCustomShape ? {} : {
      borderTopWidth: fw,
      borderTopStyle: hasFrame ? "solid" : "none",
      borderTopColor: fc,
      borderRightWidth: fw,
      borderRightStyle: hasFrame ? "solid" : "none",
      borderRightColor: fc,
      borderBottomWidth: fw,
      borderBottomStyle: hasFrame ? "solid" : "none",
      borderBottomColor: fc,
      borderLeftWidth: fw,
      borderLeftStyle: hasFrame ? "solid" : "none",
      borderLeftColor: fc,
    }),
    overflow: "hidden",
    color: vs.textColor,
    fontFamily: vs.fontFamily !== "inherit" ? vs.fontFamily : undefined,
    ...(hasCustomShape && clipD && { clipPath: "url(#style-preview-clip)" }),
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Preview</span>

      {/* clip-path def */}
      {hasCustomShape && clipD && (
        <svg width={0} height={0} style={{ display: "block" }}>
          <defs>
            <clipPath id="style-preview-clip" clipPathUnits="objectBoundingBox">
              <path d={clipD} />
            </clipPath>
          </defs>
        </svg>
      )}

      <div style={blockStyle}>
        {/* Side accent */}
        {hasSide && (
          <div
            className="absolute left-0 top-0 bottom-0 pointer-events-none"
            style={{
              width: vs.sideWidth,
              backgroundColor: vs.sideColor,
              borderRadius: hasCustomShape || vs.shape === "rectangle"
                ? 0
                : `calc(${radius} - ${fw}px) 0 0 calc(${radius} - ${fw}px)`,
            }}
          />
        )}

        {/* Text */}
        {textPos ? (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${textPos.x * 100}%`,
              top: `${textPos.y * 100}%`,
              transform: "translate(-50%, -50%)",
              maxWidth: "90%",
              textAlign: "center",
            }}
          >
            <span className="text-xs font-medium truncate block">Event Title</span>
            <span className="text-[10px] opacity-60">10:00 – 11:00</span>
          </div>
        ) : (
          <div
            className="h-full flex flex-col justify-center truncate"
            style={{
              paddingLeft: hasSide ? vs.sideWidth + 6 : Math.max(6, fw + 3),
              paddingRight: Math.max(6, fw + 3),
            }}
          >
            <span className="text-xs font-medium truncate">Event Title</span>
            <span className="text-[10px] opacity-60">10:00 – 11:00</span>
          </div>
        )}

        {/* SVG frame stroke for custom shapes */}
        {hasCustomShape && hasFrame && clipD && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            style={{ overflow: "visible" }}
          >
            <path
              d={clipD}
              fill="none"
              stroke={fc}
              strokeWidth={fw}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  )
}

// ── StyleTab ─────────────────────────────────────────────────────────────────

interface StyleTabProps {
  vs: VisualStyle
  onChange: (patch: Partial<VisualStyle>) => void
  durationPx: number
}

export default function StyleTab({ vs, onChange, durationPx }: StyleTabProps) {
  const queryClient = useQueryClient()
  const previewH = Math.max(PX_PER_HOUR * 0.5, Math.min(PX_PER_HOUR * 4, durationPx))

  const { data: palettes = [] } = useQuery<ApiPalette[]>({
    queryKey: ["palettes"],
    queryFn: async () => {
      const res = await fetch("/api/palettes")
      if (!res.ok) return []
      return res.json() as Promise<ApiPalette[]>
    },
  })

  const personalPresets = palettes
    .filter((p) => p.type === "personal" && p.colors.length > 0)
    .map((p) => ({ id: p.id, name: p.name, color: p.colors[0] }))

  async function handleAddPreset(color: string, name: string) {
    await fetch("/api/palettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "personal", colors: [color] }),
    })
    await queryClient.invalidateQueries({ queryKey: ["palettes"] })
  }

  return (
    <div className="flex flex-col gap-5 py-1">
      <EventPreview vs={vs} previewH={previewH} />

      {/* Fill */}
      <ColorInput
        label="Fill"
        value={vs.fillColor}
        onChange={(v) => onChange({ fillColor: v })}
        personalPresets={personalPresets}
        onAddPreset={handleAddPreset}
      />

      {/* Frame */}
      <div className="flex flex-col gap-2">
        <ColorInput
          label="Frame color"
          value={vs.frameColor}
          onChange={(v) => onChange({ frameColor: v })}
          personalPresets={personalPresets}
          onAddPreset={handleAddPreset}
        />
        <WidthSlider label="Frame width" value={vs.frameWidth} onChange={(v) => onChange({ frameWidth: v })} max={8} />
      </div>

      {/* Side */}
      <div className="flex flex-col gap-2">
        <ColorInput
          label="Side color"
          value={vs.sideColor}
          onChange={(v) => onChange({ sideColor: v })}
          personalPresets={personalPresets}
          onAddPreset={handleAddPreset}
        />
        <WidthSlider label="Side width" value={vs.sideWidth} onChange={(v) => onChange({ sideWidth: v })} max={12} />
      </div>

      {/* Text color */}
      <ColorInput
        label="Text color"
        value={vs.textColor}
        onChange={(v) => onChange({ textColor: v })}
        personalPresets={personalPresets}
        onAddPreset={handleAddPreset}
      />

      {/* Shape — polygon editor */}
      <PolygonEditor
        shapePath={vs.shapePath ?? null}
        onChange={(p) => onChange({ shapePath: p })}
        canvasHeight={durationPx}
        smoothing={vs.shapeSmoothing}
        onSmoothing={(v) => onChange({ shapeSmoothing: v })}
        textPosition={vs.textPosition}
        onTextPosition={(p) => onChange({ textPosition: p })}
        widthPercent={vs.widthPercent}
        onWidthPercent={(v) => onChange({ widthPercent: v })}
        leftOffset={vs.leftOffset}
        onLeftOffset={(v) => onChange({ leftOffset: v })}
      />

      {/* Font */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Font</span>
        <select
          value={vs.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="bg-smoke-800 border border-smoke-700 text-smoke-200 text-xs rounded px-2 py-1.5"
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={vs.hasCheckbox}
          onChange={(e) => onChange({ hasCheckbox: e.target.checked })}
          className="accent-doom-gold"
        />
        <span className="text-xs text-smoke-300">Show checkbox</span>
      </label>
    </div>
  )
}
