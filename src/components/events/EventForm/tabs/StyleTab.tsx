"use client"

import { useState, useRef } from "react"
import type React from "react"
import type { VisualStyle } from "@/types"

const PRESETS = [
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

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value)
  const pickerRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-smoke-500 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full h-7 rounded border border-smoke-700 hover:border-smoke-500 transition-colors"
          style={{ backgroundColor: value === "transparent" ? undefined : value }}
          title={value}
        >
          {value === "transparent" && (
            <span className="text-[10px] text-smoke-400">transparent</span>
          )}
        </button>

        {open && (
          <div className="absolute left-0 top-9 z-50 bg-smoke-800 border border-smoke-700 rounded-lg shadow-2xl p-3 w-52">
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => applyColor(c)}
                  className="w-6 h-6 rounded border border-smoke-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c === "transparent" ? undefined : c, background: c === "transparent" ? "repeating-conic-gradient(#444 0% 25%, transparent 0% 50%) 0 0 / 8px 8px" : undefined }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex gap-1.5 items-center">
              <div
                className="relative w-7 h-7 rounded border border-smoke-600 cursor-pointer shrink-0 overflow-hidden"
                onClick={() => pickerRef.current?.click()}
              >
                <div className="absolute inset-0 rounded" style={{ backgroundColor: hex !== "transparent" ? hex : "#888" }} />
                <input
                  ref={pickerRef}
                  type="color"
                  value={hex !== "transparent" ? hex : "#888888"}
                  onChange={(e) => applyHex(e.target.value)}
                  className="absolute opacity-0 w-full h-full cursor-pointer"
                />
              </div>
              <input
                type="text"
                value={hex}
                onChange={(e) => applyHex(e.target.value)}
                maxLength={9}
                className="flex-1 bg-smoke-900 border border-smoke-700 text-smoke-200 text-xs px-2 py-1 rounded font-mono"
                placeholder="#000000"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WidthInput({ value, onChange, label, max = 4 }: { value: number; onChange: (v: number) => void; label: string; max?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-smoke-500 uppercase tracking-wider">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max + 1 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`flex-1 py-1 text-xs rounded border transition-colors ${
              value === i
                ? "bg-doom-gold text-navy-950 border-doom-gold"
                : "bg-smoke-800 border-smoke-700 text-smoke-400 hover:text-smoke-200"
            }`}
          >
            {i === 0 ? "off" : `${i}`}
          </button>
        ))}
      </div>
    </div>
  )
}

function EventPreview({ vs }: { vs: VisualStyle }) {
  const fw = vs.frameWidth > 0 && vs.frameColor !== "transparent" ? vs.frameWidth : 0
  const fc = fw > 0 ? vs.frameColor : "transparent"
  const hasFrame = fw > 0
  const hasSide = vs.sideWidth > 0 && vs.sideColor !== "transparent"
  const radius = vs.shape === "pill" ? "99px" : vs.shape === "rounded" ? "4px" : "0"

  const blockStyle: React.CSSProperties = {
    position: "relative",
    backgroundColor: vs.fillColor === "transparent" ? "transparent" : vs.fillColor,
    borderRadius: radius,
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
    overflow: "hidden",
    color: vs.textColor,
    fontFamily: vs.fontFamily !== "inherit" ? vs.fontFamily : undefined,
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Preview</span>
      <div style={blockStyle} className="h-14 w-full">
        {hasSide && (
          <div
            className="absolute left-0 top-0 bottom-0 pointer-events-none"
            style={{
              width: vs.sideWidth,
              backgroundColor: vs.sideColor,
              borderRadius: vs.shape !== "rectangle"
                ? `calc(${radius} - ${fw}px) 0 0 calc(${radius} - ${fw}px)`
                : 0,
            }}
          />
        )}
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
      </div>
    </div>
  )
}

interface StyleTabProps {
  vs: VisualStyle
  onChange: (patch: Partial<VisualStyle>) => void
}

export default function StyleTab({ vs, onChange }: StyleTabProps) {
  return (
    <div className="flex flex-col gap-5 py-1">
      <EventPreview vs={vs} />

      {/* Fill */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <ColorInput label="Fill" value={vs.fillColor} onChange={(v) => onChange({ fillColor: v })} />
        </div>
      </div>

      {/* Frame */}
      <div className="flex gap-3">
        <div className="flex-1">
          <ColorInput label="Frame color" value={vs.frameColor} onChange={(v) => onChange({ frameColor: v })} />
        </div>
        <div className="w-36">
          <WidthInput label="Frame width" value={vs.frameWidth} onChange={(v) => onChange({ frameWidth: v })} />
        </div>
      </div>

      {/* Side */}
      <div className="flex gap-3">
        <div className="flex-1">
          <ColorInput label="Side color" value={vs.sideColor} onChange={(v) => onChange({ sideColor: v })} />
        </div>
        <div className="w-36">
          <WidthInput label="Side width" value={vs.sideWidth} onChange={(v) => onChange({ sideWidth: v })} max={6} />
        </div>
      </div>

      {/* Text color */}
      <ColorInput label="Text color" value={vs.textColor} onChange={(v) => onChange({ textColor: v })} />

      {/* Shape */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-smoke-500 uppercase tracking-wider">Shape</span>
        <div className="flex gap-1">
          {(["rectangle", "rounded", "pill"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ shape: s })}
              className={`flex-1 py-1.5 text-xs capitalize rounded border transition-colors ${
                vs.shape === s
                  ? "bg-doom-gold text-navy-950 border-doom-gold"
                  : "bg-smoke-800 border-smoke-700 text-smoke-400 hover:text-smoke-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

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
