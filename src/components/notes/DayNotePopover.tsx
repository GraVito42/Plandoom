"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Pencil } from "lucide-react"
import RichTextEditor from "@/components/ui/RichTextEditor"

interface DayNotePopoverProps {
  date: Date
  dayLabel: string
  isToday: boolean
}

interface DailyNoteResponse {
  content: string | null
  iconColor: string | null
}

// ── Palette localStorage (stessa logica di StyleTab) ──────────────────────────

const PRESET_STORAGE_KEY = "plandoom_color_presets"
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

// ── Filtro CSS per colorare il PNG del post-it ────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function colorToFilter(hex: string): string {
  const known: Record<string, string> = {
    "#c9a84c": "none",
    "#f3f4f6": "brightness(0) invert(1)",
    "#ffffff": "brightness(0) invert(1)",
    "#60a5fa": "brightness(0) saturate(100%) invert(58%) sepia(98%) saturate(400%) hue-rotate(190deg) brightness(101%)",
    "#34d399": "brightness(0) saturate(100%) invert(72%) sepia(50%) saturate(500%) hue-rotate(100deg)",
    "#f87171": "brightness(0) saturate(100%) invert(55%) sepia(80%) saturate(600%) hue-rotate(320deg)",
    "#c084fc": "brightness(0) saturate(100%) invert(60%) sepia(60%) saturate(500%) hue-rotate(240deg)",
    "#fb923c": "brightness(0) saturate(100%) invert(65%) sepia(80%) saturate(600%) hue-rotate(10deg)",
    "#f472b6": "brightness(0) saturate(100%) invert(65%) sepia(60%) saturate(500%) hue-rotate(290deg)",
  }
  const lower = hex.toLowerCase()
  if (known[lower]) return known[lower]
  if (!/^#[0-9a-f]{6}$/.test(lower)) return "none"
  const [h, s, l] = hexToHsl(lower)
  if (l > 85 && s < 20) return "brightness(0) invert(1)"
  if (l < 15) return "brightness(0)"
  const rotate = (h - 45 + 360) % 360
  const bright = (0.5 + l / 200).toFixed(2)
  return `brightness(0) saturate(${Math.max(50, s)}%) hue-rotate(${rotate}deg) brightness(${bright})`
}

function PostItIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <img
      src="/icons/post-it.png"
      alt=""
      width={size}
      height={size}
      style={{
        filter: colorToFilter(color),
        transition: "transform 0.15s",
      }}
      className="hover:scale-110 flex-shrink-0"
    />
  )
}

function toMidnightUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

export default function DayNotePopover({ date, dayLabel, isToday }: DayNotePopoverProps) {
  const dateUTC = toMidnightUTC(date)
  const dateISO = dateUTC.toISOString()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spectrumRef = useRef<HTMLInputElement>(null)

  // Guard hydration: document.body non esiste lato server
  useEffect(() => setMounted(true), [])

  const { data } = useQuery<DailyNoteResponse>({
    queryKey: ["dailyNote", dateISO],
    queryFn: async () => {
      const res = await fetch(`/api/notes/daily?date=${encodeURIComponent(dateISO)}`)
      if (!res.ok) throw new Error("Failed to load daily note")
      return res.json() as Promise<DailyNoteResponse>
    },
  })

  const hasContent = !!(data?.content && data.content.replace(/<[^>]*>/g, "").trim())
  const iconColor = data?.iconColor ?? "#c9a84c"

  // Icona post-it visibile solo dopo la chiusura del popover, non durante la digitazione
  const [savedHasContent, setSavedHasContent] = useState(false)
  useEffect(() => {
    if (!open) {
      setSavedHasContent(hasContent)
    }
  }, [hasContent, open])

  // Palette da localStorage — sincronizzata con StyleTab
  const [paletteColors, setPaletteColors] = useState<string[]>(() => loadPresets())
  useEffect(() => {
    const reload = () => setPaletteColors(loadPresets())
    window.addEventListener("plandoom:presets-changed", reload)
    return () => window.removeEventListener("plandoom:presets-changed", reload)
  }, [])

  // Apre/chiude il popover calcolando la posizione assoluta del trigger
  const handleOpen = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPopoverPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX + rect.width / 2,
      })
    }
    setOpen((v) => !v)
  }, [])

  const save = useCallback(
    (content: string, color?: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(async () => {
        await fetch(`/api/notes/daily?date=${encodeURIComponent(dateISO)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            ...(color ? { iconColor: color } : {}),
          }),
        })
        await queryClient.invalidateQueries({ queryKey: ["dailyNote", dateISO] })
      }, 500)
    },
    [dateISO, queryClient]
  )

  const handleContentChange = useCallback(
    (html: string) => save(html),
    [save]
  )

  const handleColorChange = useCallback(
    (color: string) => {
      const currentContent = data?.content ?? "<p></p>"
      save(currentContent, color)
    },
    [data?.content, save]
  )

  // Click outside → chiudi popover (controlla sia trigger che popover nel Portal)
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const popoverContent = (
    <div
      ref={popoverRef}
      style={{
        position: "absolute",
        top: popoverPos?.top ?? 0,
        left: popoverPos?.left ?? 0,
        transform: "translateX(-50%)",
        zIndex: 9999,
      }}
      className="w-72 bg-navy-900 border border-smoke-700 rounded-lg shadow-2xl p-2 flex flex-col gap-2"
    >
      {/* Color picker — palette utente da localStorage + spectrum picker */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-smoke-500 shrink-0">Note color:</span>
        {paletteColors.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleColorChange(c)}
            className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 shrink-0 ${
              iconColor === c ? "border-smoke-100" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        {/* Spectrum picker — input nascosto, aperto dal pulsante "+" */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => spectrumRef.current?.click()}
            className="w-4 h-4 rounded-full border border-dashed border-smoke-500 text-smoke-500 hover:border-doom-gold hover:text-doom-gold transition-colors flex items-center justify-center text-[10px] leading-none"
            title="Pick custom color"
          >
            +
          </button>
          <input
            ref={spectrumRef}
            type="color"
            value={iconColor.startsWith("#") && iconColor.length === 7 ? iconColor : "#c9a84c"}
            onChange={(e) => handleColorChange(e.target.value)}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
          />
        </div>
      </div>

      {/* Editor */}
      <RichTextEditor
        content={data?.content ?? null}
        onChange={handleContentChange}
        placeholder="Daily note..."
      />
    </div>
  )

  return (
    <div ref={triggerRef}>
      {/* Header giornaliero */}
      <div className={`py-2 text-center border-b border-smoke-700 ${isToday ? "bg-navy-800/60" : ""}`}>

        {/* Riga 1: nome giorno + icona post-it (solo se nota presente) */}
        <div className="flex items-center justify-center gap-1.5">
          {savedHasContent && <span className="w-4 flex-shrink-0" />}

          <span
            className={`text-xs font-semibold tracking-widest uppercase ${
              isToday ? "text-doom-gold" : "text-smoke-300"
            }`}
          >
            {dayLabel}
          </span>

          {savedHasContent && (
            <button
              type="button"
              onClick={handleOpen}
              className="flex-shrink-0 focus:outline-none overflow-hidden"
              title="Open note"
            >
              <PostItIcon color={iconColor} size={14} />
            </button>
          )}
        </div>

        {/* Riga 2: numero giorno + matita su hover (solo se non c'è nota) */}
        <div className="group relative flex items-center justify-center gap-1 mt-0.5">
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-1 focus:outline-none"
          >
            <span className={`text-xs ${isToday ? "text-doom-gold/70" : "text-smoke-400"}`}>
              {date.getDate()}
            </span>
            {!savedHasContent && (
              <Pencil
                size={9}
                className="text-smoke-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              />
            )}
          </button>
        </div>

      </div>

      {/* Popover renderizzato via Portal su document.body per uscire dallo
          stacking context dell'elemento sticky del day header */}
      {open && popoverPos && mounted && createPortal(popoverContent, document.body)}
    </div>
  )
}
