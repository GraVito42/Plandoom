"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useCallback, useEffect, useState } from "react"
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

const PRESET_COLORS = [
  "#c9a84c", // doom-gold
  "#f3f4f6", // smoke-100
  "#60a5fa", // blue
  "#34d399", // green
  "#f87171", // red
  "#c084fc", // violet
  "#fb923c", // orange
  "#f472b6", // pink
]

function colorToFilter(hex: string): string {
  const map: Record<string, string> = {
    "#c9a84c": "none",
    "#f3f4f6": "brightness(0) invert(1)",
    "#60a5fa": "brightness(0) saturate(100%) invert(58%) sepia(98%) saturate(400%) hue-rotate(190deg) brightness(101%)",
    "#34d399": "brightness(0) saturate(100%) invert(72%) sepia(50%) saturate(500%) hue-rotate(100deg)",
    "#f87171": "brightness(0) saturate(100%) invert(55%) sepia(80%) saturate(600%) hue-rotate(320deg)",
    "#c084fc": "brightness(0) saturate(100%) invert(60%) sepia(60%) saturate(500%) hue-rotate(240deg)",
    "#fb923c": "brightness(0) saturate(100%) invert(65%) sepia(80%) saturate(600%) hue-rotate(10deg)",
    "#f472b6": "brightness(0) saturate(100%) invert(65%) sepia(60%) saturate(500%) hue-rotate(290deg)",
  }
  return map[hex.toLowerCase()] ?? "none"
}

function PostItIcon({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <img
      src="/icons/post-it.png"
      alt="note"
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
  const popoverRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Click outside → chiudi popover
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={popoverRef}>
      {/* Header giornaliero */}
      <div className={`py-2 text-center border-b border-smoke-700 ${isToday ? "bg-navy-800/60" : ""}`}>

        {/* Riga 1: nome giorno + icona post-it (solo se nota presente) */}
        <div className="flex items-center justify-center gap-1.5">
          {/* Spacer sinistro per bilanciare visivamente quando c'è l'icona */}
          {hasContent && <span className="w-4 flex-shrink-0" />}

          <span
            className={`text-xs font-semibold tracking-widest uppercase ${
              isToday ? "text-doom-gold" : "text-smoke-300"
            }`}
          >
            {dayLabel}
          </span>

          {/* Icona post-it colorata — click apre popover */}
          {hasContent && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex-shrink-0 focus:outline-none"
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
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 focus:outline-none"
          >
            <span className={`text-xs ${isToday ? "text-doom-gold/70" : "text-smoke-400"}`}>
              {date.getDate()}
            </span>
            {/* Icona matita su hover se non c'è nota */}
            {!hasContent && (
              <Pencil
                size={9}
                className="text-smoke-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              />
            )}
          </button>
        </div>

      </div>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 z-50 mt-1 w-72 bg-navy-900 border border-smoke-700 rounded-lg shadow-2xl p-2 flex flex-col gap-2">
          {/* Color picker */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-smoke-500">Note color:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleColorChange(c)}
                className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${
                  iconColor === c ? "border-smoke-100" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {/* Editor */}
          <RichTextEditor
            content={data?.content ?? null}
            onChange={handleContentChange}
            placeholder="Daily note..."
          />
        </div>
      )}
    </div>
  )
}
