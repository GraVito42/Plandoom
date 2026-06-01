"use client"

import { useState, useRef, useEffect } from "react"
import type React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Briefcase, Star, Heart, Flame, Zap, BookOpen, Tag, Flag,
  Home, Music, Camera, Coffee, Leaf, Globe, Shield, Bell,
} from "lucide-react"
import type { VisualStyle, FolderSymbol } from "@/types"
import PolygonEditor from "./PolygonEditor"
import { PX_PER_HOUR } from "@/hooks/useGrid"
import { pathToPoints, smoothedPath } from "@/lib/shapeUtils"

// ── Folder symbol icon registry ───────────────────────────────────────────────

const SYMBOL_ICONS = {
  Briefcase, Star, Heart, Flame, Zap, BookOpen, Tag, Flag,
  Home, Music, Camera, Coffee, Leaf, Globe, Shield, Bell,
} as const

type SymbolIconName = keyof typeof SYMBOL_ICONS
const ICON_NAMES = Object.keys(SYMBOL_ICONS) as SymbolIconName[]


// ── Helpers ───────────────────────────────────────────────────────────────────

function fillWithOpacity(color: string, opacity: number): string {
  if (opacity >= 100 || color === "transparent") return color
  const hex = color.startsWith("#") ? color.slice(1) : null
  if (!hex || (hex.length !== 6 && hex.length !== 3)) return color
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16)
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16)
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${(opacity / 100).toFixed(2)})`
}

// ── FolderSymbolSection ───────────────────────────────────────────────────────

function FolderSymbolSection({
  folderSymbol,
  onFolderSymbol,
}: {
  folderSymbol: FolderSymbol | null
  onFolderSymbol: (sym: FolderSymbol | null) => void
}) {
  const sym = folderSymbol

  function patch(partial: Partial<FolderSymbol>) {
    onFolderSymbol({
      icon: sym?.icon ?? "Star",
      customImage: sym?.customImage ?? null,
      color: sym?.color ?? "#c9a84c",
      size: sym?.size ?? 24,
      position: sym?.position ?? null,
      ...partial,
    })
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      patch({ icon: null, customImage: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-2.5 border border-smoke-700 rounded-lg p-3 bg-smoke-900/40">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Folder Symbol</span>
        {sym && (
          <button
            type="button"
            onClick={() => onFolderSymbol(null)}
            className="text-[10px] text-smoke-500 hover:text-doom-ember transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Icon grid */}
      <div className="grid grid-cols-8 gap-1">
        {ICON_NAMES.map((name) => {
          const Icon = SYMBOL_ICONS[name]
          const active = sym?.icon === name && !sym.customImage
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => patch({ icon: name, customImage: null })}
              className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${
                active
                  ? "bg-doom-gold/20 border border-doom-gold/60 text-doom-gold"
                  : "bg-smoke-800 border border-smoke-700 text-smoke-400 hover:text-smoke-200 hover:border-smoke-500"
              }`}
            >
              <Icon size={11} />
            </button>
          )
        })}
      </div>

      {/* PNG upload */}
      <div className="flex items-center gap-2">
        <label className="flex-1 flex items-center gap-2 cursor-pointer">
          <span className={`text-[10px] px-2 py-1 rounded border transition-colors ${
            sym?.customImage
              ? "border-doom-gold/60 text-doom-gold bg-doom-gold/10"
              : "border-smoke-700 text-smoke-500 hover:text-smoke-300 hover:border-smoke-500"
          }`}>
            {sym?.customImage ? "PNG loaded" : "Upload PNG"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />
        </label>
        {sym?.customImage && (
          <button
            type="button"
            onClick={() => patch({ customImage: null, icon: "Star" })}
            className="text-[10px] text-smoke-500 hover:text-doom-ember transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {sym && (
        <>
          {/* Color */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-smoke-500 w-8 shrink-0">Color</span>
            <input
              type="color"
              value={sym.color}
              onChange={(e) => patch({ color: e.target.value })}
              className="w-6 h-5 rounded border border-smoke-700 cursor-pointer bg-transparent p-0.5 shrink-0"
            />
            <input
              value={sym.color}
              onChange={(e) => patch({ color: e.target.value })}
              className="flex-1 min-w-0 bg-smoke-800 border border-smoke-700 text-smoke-200 text-[10px] font-mono rounded px-1.5 py-1 focus:outline-none focus:border-smoke-500"
            />
          </div>

          {/* Size */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-smoke-500 w-8 shrink-0">Size</span>
            <input
              type="range"
              min={12}
              max={96}
              step={2}
              value={sym.size}
              onChange={(e) => patch({ size: Number(e.target.value) })}
              className="flex-1 accent-doom-gold"
            />
            <span className="text-[10px] text-smoke-400 w-8 text-right shrink-0 tabular-nums">{sym.size}px</span>
          </div>

          <p className="text-[10px] text-smoke-600">
            Position: use the canvas below — click "Place symbol" to add the ◈ handle and drag it.
          </p>
        </>
      )}
    </div>
  )
}

const COLOR_PRESETS = [
  "#162d5e", "#0f2044", "#1e3a78", "#2a4d96",
  "#c9a84c", "#8b3a2a", "#4a2d6b", "#1a1c1e",
  "#d1d5db", "#6b7280", "transparent",
]

const PRESET_STORAGE_KEY = "plandoom_color_presets"
const MAX_PRESETS = 20
const PRESET_DEFAULTS = [
  "#162d5e", "#0f2044", "#1e3a78", "#2a4d96", "#4a2d6b",
  "#23262a", "#2e3236", "#484e55", "#3d1a12", "#8b3a2a",
  "#3d2e0e", "#c9a84c", "#d4b483", "#9ca3af", "#d1d5db",
  "#f3f4f6", "#ffffff",
]

function loadPresets(): string[] {
  if (typeof window === "undefined") return [...PRESET_DEFAULTS]
  const raw = localStorage.getItem(PRESET_STORAGE_KEY)
  if (!raw) {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(PRESET_DEFAULTS))
    return [...PRESET_DEFAULTS]
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed as string[]
  } catch { /* ignore */ }
  return [...PRESET_DEFAULTS]
}

function savePresets(presets: string[]) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets))
}

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
  onActive,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  onActive?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value)
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

  const hexPreview = hex !== "transparent" && /^#[0-9a-fA-F]{3,6}$/.test(hex) ? hex : "#888888"

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-smoke-500 uppercase tracking-wider">{label}</span>
      <div className="relative">

        {/* Trigger — shows current color */}
        <button
          type="button"
          onClick={() => { setOpen((p) => !p); onActive?.() }}
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

            {/* Preset swatches */}
            <div className="grid grid-cols-6 gap-1.5 mb-3">
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

            {/* Custom color row: picker + hex input */}
            <div className="flex gap-1.5 items-center">
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

          </div>
        )}
      </div>
    </div>
  )
}

// ── ColourPresetsPanel ────────────────────────────────────────────────────────

interface ColourPresetsPanelProps {
  activeColor: string
  onApply: (color: string) => void
  prioritySwatches?: string[]
}

function ColourPresetsPanel({ activeColor, onApply, prioritySwatches }: ColourPresetsPanelProps) {
  const [presets, setPresets] = useState<string[]>(() => loadPresets())

  useEffect(() => {
    const reload = () => setPresets(loadPresets())
    window.addEventListener("plandoom:presets-changed", reload)
    return () => window.removeEventListener("plandoom:presets-changed", reload)
  }, [])

  const isPaletteMode = !!prioritySwatches
  const swatches = isPaletteMode ? prioritySwatches : presets

  function addPreset() {
    if (!activeColor || activeColor === "transparent") return
    setPresets((prev) => {
      if (prev.includes(activeColor)) return prev
      const next = prev.length >= MAX_PRESETS ? [...prev.slice(1), activeColor] : [...prev, activeColor]
      savePresets(next)
      return next
    })
  }

  function deletePreset(idx: number) {
    setPresets((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      savePresets(next)
      return next
    })
  }

  function resetDefaults() {
    const d = [...PRESET_DEFAULTS]
    savePresets(d)
    setPresets(d)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-smoke-500 uppercase tracking-wider">
          {isPaletteMode ? "Palette" : "Presets"}
        </span>
        {!isPaletteMode && (
          <button
            type="button"
            onClick={addPreset}
            disabled={
              !activeColor ||
              activeColor === "transparent" ||
              presets.includes(activeColor) ||
              presets.length >= MAX_PRESETS
            }
            title="Save active colour as preset"
            className="text-sm text-doom-gold hover:text-doom-gold/80 disabled:opacity-30 transition-colors leading-none px-1"
          >
            +
          </button>
        )}
      </div>
      {!isPaletteMode && presets.length === 0 ? (
        <button
          type="button"
          onClick={resetDefaults}
          className="self-start text-[10px] text-smoke-500 hover:text-smoke-300 border border-smoke-700 hover:border-smoke-500 rounded px-2 py-1 transition-colors"
        >
          Reset default colours
        </button>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((c, i) => (
            <div key={i} className={isPaletteMode ? "" : "relative group"}>
              <button
                type="button"
                onClick={() => onApply(c)}
                title={c}
                className="w-5 h-5 rounded hover:scale-110 transition-transform overflow-hidden"
                style={{
                  background: c,
                  outline: activeColor === c ? "2px solid #c9a84c" : "1px solid #3a3f45",
                  outlineOffset: activeColor === c ? "2px" : "0",
                }}
              />
              {!isPaletteMode && (
                <button
                  type="button"
                  onClick={() => deletePreset(i)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-smoke-700 text-smoke-400 hover:bg-doom-ember hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] leading-none"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
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

function EventPreview({ vs, previewH, folderSymbol }: { vs: VisualStyle; previewH: number; folderSymbol?: FolderSymbol | null }) {
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
    backgroundColor: vs.fillColor === "transparent" ? "transparent" : fillWithOpacity(vs.fillColor, vs.fillOpacity),
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

        {/* Folder symbol overlay */}
        {folderSymbol && (() => {
          const pos = folderSymbol.position ?? { x: 0.85, y: 0.1 }
          const iconSize = folderSymbol.size
          const IconComp = folderSymbol.icon ? SYMBOL_ICONS[folderSymbol.icon as SymbolIconName] : null
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 10,
                lineHeight: 0,
              }}
            >
              {folderSymbol.customImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={folderSymbol.customImage} alt="" style={{ width: iconSize, height: iconSize, objectFit: "contain" }} />
              ) : IconComp ? (
                <IconComp size={iconSize} color={folderSymbol.color} />
              ) : null}
            </div>
          )
        })()}

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
  // Optional: only passed when editing a folder's default style
  folderSymbol?: FolderSymbol | null
  onFolderSymbol?: (sym: FolderSymbol | null) => void
  // Optional: colours from folder palette (FIX 3); takes priority over active palette
  prioritySwatches?: string[]
}

type ActiveColorField = "fillColor" | "frameColor" | "sideColor" | "textColor"

type GlobalPreset = {
  id: string
  name: string
  visualStyle: { path: string; smoothing?: number; fillColor?: string; frameColor?: string }
}

export default function StyleTab({ vs, onChange, durationPx, folderSymbol, onFolderSymbol, prioritySwatches }: StyleTabProps) {
  const previewH = Math.max(PX_PER_HOUR * 0.5, Math.min(PX_PER_HOUR * 4, durationPx))
  const [activeField, setActiveField] = useState<ActiveColorField>("fillColor")
  const activeColor = vs[activeField]

  const { data: globalPresets } = useQuery<GlobalPreset[]>({
    queryKey: ["shape-presets-global"],
    queryFn: async () => {
      const r = await fetch("/api/shape-presets")
      if (!r.ok) throw new Error("fetch failed")
      return r.json() as Promise<GlobalPreset[]>
    },
    staleTime: 5 * 60 * 1000,
  })

  function applyPreset(color: string) {
    onChange({ [activeField]: color } as Partial<VisualStyle>)
  }

  return (
    <div className="flex flex-col gap-5 py-1">
      <EventPreview vs={vs} previewH={previewH} folderSymbol={folderSymbol} />

      {/* Gerarchia: prioritySwatches (folder palette) > plandoom_color_presets */}
      <ColourPresetsPanel activeColor={activeColor} onApply={applyPreset} prioritySwatches={prioritySwatches} />

      {/* Folder symbol — only in folder style context */}
      {onFolderSymbol !== undefined && (
        <FolderSymbolSection
          folderSymbol={folderSymbol ?? null}
          onFolderSymbol={onFolderSymbol}
        />
      )}

      {/* Fill */}
      <div className="flex flex-col gap-2">
        <ColorInput
          label="Fill"
          value={vs.fillColor}
          onChange={(v) => onChange({ fillColor: v })}
          onActive={() => setActiveField("fillColor")}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-smoke-500 uppercase tracking-wider w-14 shrink-0">Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={vs.fillOpacity}
            onChange={(e) => onChange({ fillOpacity: Number(e.target.value) })}
            className="flex-1 accent-doom-gold"
          />
          <span className="text-[10px] text-smoke-400 w-8 text-right shrink-0 tabular-nums">{vs.fillOpacity}%</span>
        </div>
      </div>

      {/* Frame */}
      <div className="flex flex-col gap-2">
        <ColorInput
          label="Frame color"
          value={vs.frameColor}
          onChange={(v) => onChange({ frameColor: v })}
          onActive={() => setActiveField("frameColor")}
        />
        <WidthSlider label="Frame width" value={vs.frameWidth} onChange={(v) => onChange({ frameWidth: v })} max={8} />
      </div>

      {/* Side */}
      <div className="flex flex-col gap-2">
        <ColorInput
          label="Side color"
          value={vs.sideColor}
          onChange={(v) => onChange({ sideColor: v })}
          onActive={() => setActiveField("sideColor")}
        />
        <WidthSlider label="Side width" value={vs.sideWidth} onChange={(v) => onChange({ sideWidth: v })} max={12} />
      </div>

      {/* Text color */}
      <ColorInput
        label="Text color"
        value={vs.textColor}
        onChange={(v) => onChange({ textColor: v })}
        onActive={() => setActiveField("textColor")}
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
        globalPresets={globalPresets}
        folderSymbolPosition={onFolderSymbol ? (folderSymbol?.position ?? null) : undefined}
        onFolderSymbolPosition={onFolderSymbol
          ? (pos) => onFolderSymbol(
              folderSymbol
                ? { ...folderSymbol, position: pos }
                : { icon: "Star", customImage: null, color: "#c9a84c", size: 24, position: pos }
            )
          : undefined}
        folderSymbolIcon={folderSymbol?.icon ?? null}
        folderSymbolImage={folderSymbol?.customImage ?? null}
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
